import BSON from "bson"
import fs from "fs"

export default class WriteHandler {

  constructor(filename, disableBatching) {
    this.locked = false;
    this.filename = filename;
    this.disableBatching = disableBatching;
    this.queue = []
    this.firstAdd = null;
    this.lockPromise = null;
  }

  async write(data) {

    this.queue.push(data);

    if (this.disableBatching === true) {
      await this.doWriteQueue();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.doWriteQueue(), 500)
    }
  }

  async doWriteQueue() {
    this.timer = null;

    while (this.locked)
      await this.lockPromise;

    if (this.queue.length < 1)
      return;

    this.lockPromise = new Promise(async (resolveLock) => {
      this.locked = true;

      let buffers = this.queue.map(o => BSON.serialize(o));
      this.queue = [];

      let combinedLength = (4 * buffers.length) + buffers.reduce((sum, cur) => cur.length + sum, 0);
      let buffer = Buffer.alloc(combinedLength);

      let curPos = 0;
      for (let b of buffers) {
        buffer.writeUInt32BE(b.length, curPos);
        curPos += 4;

        b.copy(buffer, curPos);
        curPos += b.length;
      }

      let successful = false;
      while (!successful) {
        try {
          await new Promise((resolve, reject) => fs.appendFile(this.filename, buffer, err => err ? reject(err) : resolve()))
          successful = true;
        } catch (err) {
          console.log(err)
          console.log(`Catched an error writing ${this.filename}. Retrying...`)
          await new Promise(r => setTimeout(r, 100));
        }
      }

      this.locked = false;
      resolveLock();
    })
  }

  async flush() {
    await this.doWriteQueue();
  }
}