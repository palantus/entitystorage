import BSON from "bson";
import fs from "fs"

export default class ReadHandler{
    async read(filename, onRecord){
        let fileExists = await new Promise(resolve => fs.stat(filename, (err, stats) => resolve(err ? false : true)));
        if(!fileExists) return;
        let fileSize = await new Promise(resolve => fs.stat(filename, (err, stats) => resolve(stats.size)));
        let fd = await new Promise(resolve =>fs.open(filename, 'r', '0666', (err, fd) => err ? console.log(err) : resolve(fd)));
        let curPos = 0;

        let buffer = await new Promise(resolve => fs.readFile(filename, (err, data ) => err ? console.log(err) : resolve(data)));
        while(curPos < fileSize-1){
            let length = buffer.readUInt32BE(curPos);
            curPos += 4;

            let bufferData = Buffer.alloc(length);
            buffer.copy(bufferData, 0, curPos, curPos+length);
            curPos += length;
            
            try{
                let data = BSON.deserialize(bufferData);
                await onRecord(data)
            } catch(err){
                console.log(err);
                console.log(`The data file ${filename} seems to be corrupt. Stopping import after first corrupt record.`)
                break;
            }
        }

        /*
        while(curPos < fileSize-1){
            let bufferLen = Buffer.alloc(4);
            await new Promise(resolve => fs.read(fd, bufferLen, 0, bufferLen.length, curPos, err => err ? console.log(err) : resolve()))
            let length = bufferLen.readUInt32BE(0);
            curPos += 4;

            let bufferData = Buffer.alloc(length);
            await new Promise(resolve => fs.read(fd, bufferData, 0, bufferData.length, curPos, err => err ? console.log(err) : resolve()))
            curPos += length;
            
            try{
                let data = BSON.deserialize(bufferData);
                await onRecord(data)
            } catch(err){
                console.log(err);
                console.log(`The data file ${filename} seems to be corrupt. Stopping import after first corrupt record.`)
                break;
            }
        }
        */
    }
}