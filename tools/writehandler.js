let BSON = require("bson");
let fs = require("fs")

class WriteHandler{

    constructor(filename, disableBatching){
        this.locked = false;
        this.filename = filename;
        this.disableBatching = disableBatching;
        this.queue = []
        this.firstAdd = null;
        this.lockPromise = null;
    }

    async write(data){

        this.queue.push(data);

        if(this.disableBatching === true){
            await this.doWriteQueue();
        } else if(!this.timer){
            this.timer = setTimeout(() => this.doWriteQueue(), 500)
        }
    }

    async doWriteQueue(){
        while(this.locked)
            await this.lockPromise;
            
        this.lockPromise = new Promise(async (resolve) => {
            this.locked = true;

            console.log("Writing")

            let buffers = this.queue.map(o => BSON.serialize(o));
            this.queue = [];

            let combinedLength = (4*buffers.length) + buffers.reduce((sum, cur) => cur.length + sum, 0);
            let buffer = Buffer.alloc(combinedLength);

            let curPos = 0;
            for(let b of buffers){
                buffer.writeUInt32BE(b.length, curPos);
                curPos += 4;

                b.copy(buffer, curPos);
                curPos += b.length;
            }

            await new Promise(resolve => fs.appendFile(this.filename, buffer, err => err ? console.log(err) : resolve()))

            this.locked = false;
            resolve();
        })
    }
}

module.exports = WriteHandler