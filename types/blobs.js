"use strict"

const WriteHandler = require("../tools/writehandler.js");
const ReadHandler = require("../tools/readhandler.js");
const stream = require('stream');
const fs = require('fs').promises;
const fs2 = require('fs');
const path = require('path')

class Blob {

  constructor(dbPath, history) {
    this.idSet = new Set();
    this.dbPath = dbPath || "./"
    this.cacheWhenWriting = {}
    this.history = history
  }

  async init() {
    await this.readIndexFile()
    try{
      await fs.access(path.resolve(this.dbPath, "blobs"))
    } catch(err){
      await fs.mkdir(path.resolve(this.dbPath, "blobs")) 
    }
    return this;
  }

  async write(data) {
    if (this.writeHandler === undefined)
      this.writeHandler = new WriteHandler(path.resolve(this.dbPath, "blob_index.data"));

    await this.writeHandler.write(data)
  }

  async readIndexFile() {
    let rd = new ReadHandler();
    await rd.read(path.resolve(this.dbPath, 'blob_index.data'), (data) => {
      let id = data.id

      if (data.o == 1) {
        this.idSet.add(id)
      } else {
        this.idSet.delete(id)
      }
    })
  }

  async set(id, data) {
    if (typeof data === "string") {
      data = Buffer.from(data)
    }

    this.cacheWhenWriting[id] = data;

    if (Buffer.isBuffer(data) || (typeof data.on === 'function' && typeof data.read === 'function')) {
      let filename = path.resolve(this.dbPath, `blobs/${id}.data`)
      let fd = await fs.open(filename, 'w')
      await fd.writeFile(data)
      fd.close()
    } else {
      throw "Unknown type for blob. Supports strings, buffers and streams"
    }

    this.idSet.add(id)
    this.write({ o: 1, id })
    delete this.cacheWhenWriting[id]
    this.history?.addEntry(id, "blob", { operation: "set" })
  }

  delete(id) {
    let filename = path.resolve(this.dbPath, `blobs/${id}.data`)
    fs.access(filename).then((err) => {
      if(!err) fs.unlink(filename)
    }).catch(err => null)
    
    this.write({o: 0, id})
    this.idSet.delete(id)
    this.history?.addEntry(id, "blob", { operation: "remove" })
  }

  get(id) {
    if (!this.idSet.has(id))
      return null;

    if (this.cacheWhenWriting[id] !== undefined)
      return stream.Readable.from(this.cacheWhenWriting[id]);

    let filename = path.resolve(this.dbPath, `blobs/${id}.data`)

    let stream = null;
    try{
      stream = fs2.createReadStream(filename);
      stream.on('error', function(err) {
        console.log(err)
      });
    } catch(err){
      console.log(err)
    }
    return stream;
  }

  getMaxId() {
    return Array.from(this.idSet).reduce((max, e) => Math.max(max, e), 0);
  }

  getAllIds() {
    return this.idSet.values()
  }
}

module.exports = Blob