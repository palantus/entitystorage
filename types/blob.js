"use strict"

const WriteHandler = require("../tools/writehandler.js");
const ReadHandler = require("../tools/readhandler.js");
const stream = require('stream');
const fs = require('fs').promises;
const path = require('path')

class Blob{
    
    constructor(dbPath){
        this.idSet = new Set();
        this.blobs = {}
        this.files = []
        this.freedChunks = []
        this.dbPath = dbPath || "./"
        this.nextFileId = 1;
        this.maxFileSize = 100000000; // 100MB; max size of individual data files (not blobs!)
    }

    async init(){
        await this.readIndexFile()
        return this;
    }

    async write(data){
        if(this.writeHandler === undefined)
            this.writeHandler = new WriteHandler(this.dbPath);

        await this.writeHandler.write(data)
    }

    async readIndexFile(){
        let rd = new ReadHandler();
        await rd.read(path.resolve(this.dbPath, 'blob_index.data'), (data) => {
            let id = data.id

            if(data.o == 1){

                this.idSet.add(id)

            } else if(this.idSet.has(data.tag)) {

                this.idSet.delete(id)
            }
        })

        if(this.files.length < 1){
            this.addDataFile()
        }
    }

    addDataFile(){
        this.files.push({id: this.nextFileId, size: 0})
        this.nextFileId++;
    }

    async set(id, stream, encoding){
        encoding = encoding || null;
        let writer = new Writer(this, id);
        if(this.blobs[id] !== undefined){
            throw "Data is already written to this entity. Delete it first."
        }

        this.blobs[id] = []

        if(typeof stream === "string"){
            encoding = encoding || "utf8";
            stream = Buffer.from(stream, encoding)
        }

        if(Buffer.isBuffer(stream)){
            if(stream.length <= this.maxFileSize){
                await writer._write(stream, encoding)
            } else {
                let i = 0;
                while (i < stream.length) {
                    await writer._write(buffer.slice(i, i += this.maxFileSize));
                }
            }
        } else if (typeof stream.on === 'function' && typeof stream.read === 'function'){
           let p = stream.pipe(writer)
           await new Promise(resolve => p.on('finish', () => {
               writer.close()
               resolve()}
            ))
        } else {
            throw "Unknown type for blob. Supports strings, buffers and streams"
        }
    }

    delete(id){
        if(this.blobs[id] !== undefined){
            if(this.blobs[id].length > 0)
                this.freedChunks.push(...this.blobs[id])
            delete this.blobs[id]
        }
    }
        
    getFreeChunk(size, preferFile){
        let curFileId = preferFile || 1;

        while(true){

            if(curFileId == this.nextFileId){
                this.addDataFile()
            }

            let idx = this.freedChunks.findIndex(c => (c.file == curFileId && c.size >= size))
            if(idx >= 0){
                return this.freedChunks.splice(idx, 1)[0]
            }
            let file = this.files.find(f => f.id == curFileId)
            if(file.size + size <= this.maxFileSize){
                let pos = file.size;
                file.size += size;
                
                return {file: curFileId, pos, size}
            }

            curFileId++;
        }
    }
}

class Writer extends stream.Writable{
    constructor(blob, id, ...args){
        super(...args)
        this.blob = blob;
        this.id = id;

        this.lastFd = null;
        this.lastFileId = null;
    }

    async _write(data, encoding, callback) {

        let chunk = this.blob.getFreeChunk(data.length, this.lastFileId || null)

        this.blob.blobs[this.id].push(chunk)
        let fd = this.lastFileId == chunk.file ? this.lastFd : await fs.open(path.resolve(this.blob.dbPath, `blob_${chunk.file}.data`), 'w+')
        await fd.write(data, 0, data.length, chunk.pos)

        this.lastFileId = chunk.file;
        this.lastFd = fd;
        callback()
    }
    
    close(){
        if(this.lastFd){
            this.lastFd.close()
        }
    }
}

class Reader extends stream.Readable{
    constructor(...args){
        let chunks = args.shift();
        super(...args)

        this.chunks = chunks;
        this.curStream = null;
        this.curPos = null;
        this.endPos = null;
        this.chunkIdx = 0;
    }

    _read = function() {
        /*
        var num = this._curr;
        var buf = Buffer.from(num.toString(), 'utf-8');
        
        this.push(buf);
        this._curr++;
    
        if (num === this._end) {
            this.push(null);
        }
        */
    }
}

module.exports = Blob