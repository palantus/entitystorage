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

    async set(id, data){
        let writer = new Writer(this, id);
        if(this.blobs[id] !== undefined){
            throw "Data is already written to this entity. Delete it first."
        }

        this.blobs[id] = []

        if(typeof data === "string"){
            data = Buffer.from(data)
        }

        if(Buffer.isBuffer(data)){
            if(data.length <= this.maxFileSize){
                await writer._write(data)
            } else {
                let i = 0;
                while (i < data.length) {
                    await writer._write(buffer.slice(i, i += this.maxFileSize));
                }
            }
        } else if (typeof data.on === 'function' && typeof data.read === 'function'){
           let p = data.pipe(writer)
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

    get(id){
        if(this.blobs[id] === undefined)
            return null;

        let reader = new Reader(this, this.blobs[id]);
        return reader;
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
        if(typeof callback === 'function'){
            callback()
        }
    }
    
    close(){
        if(this.lastFd){
            this.lastFd.close()
        }
    }
}

class Reader extends stream.Readable{
    constructor(blob, chunks, ...args){
        super(...args)

        this.blob = blob;
        this.chunks = chunks;
        this.lastFileId = null;
    }

    async _read () {
        if(this.chunks.length < 1){
            this.push(null)
            return;
        }

        let chunk = this.chunks.shift()
        let fd = this.lastFileId == chunk.file ? this.lastFd : await fs.open(path.resolve(this.blob.dbPath, `blob_${chunk.file}.data`), 'r')

        let buffer = Buffer.alloc(chunk.size)
        await fd.read(buffer, 0, chunk.size, chunk.pos)
        this.lastFileId = chunk.file;
        this.push(buffer);
    }
}

module.exports = Blob