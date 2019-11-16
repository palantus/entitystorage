let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");

class Tags{
    
    constructor(dbPath){
        this.tag2ids = {}
        this.id2tags = {}
        this.idSet = new Set();
        this.dbPath = dbPath || "tags.data"
    }

    async init(){
        await this.readDB()
        return this;
    }

    async write(data){
        if(this.writeHandler === undefined)
            this.writeHandler = new WriteHandler(this.dbPath);

        await this.writeHandler.write(data)
    }

    async readDB(){
        let rd = new ReadHandler();
        await rd.read(this.dbPath, (data) => {
            let id = data.id
            let tag = data.tag

            if(data.o == 1){
                if(this.tag2ids[tag] === undefined){
                    this.tag2ids[tag] = [id]
                } else if(this.tag2ids[tag].indexOf(id) < 0){
                    this.tag2ids[tag].push(id)
                } else return;
        
                if(this.id2tags[id] === undefined)
                    this.id2tags[id] = [tag]
                else
                    this.id2tags[id].push(tag)

                this.idSet.add(id)

            } else if(this.tag2ids[data.tag] !== undefined) {
                this.tag2ids[tag].splice(this.tag2ids[tag].indexOf(id), 1)
                this.id2tags[id].splice(this.id2tags[id].indexOf(tag), 1)
                if(this.id2tags[id].length < 1)
                    this.idSet.delete(id)
            }
        })
        
    }

    getMaxId(){
        return Object.values(this.tag2ids).reduce((max, e) => Math.max(max, Math.max(...e)), 0);
    }

    getAllIds(){
        return this.idSet.values()
    }

    addTag(id, tag){
        id = parseInt(id)

        if(this.tag2ids[tag] !== undefined && this.tag2ids[tag].indexOf(tag) >= 0)
            return;
        
        if(this.tag2ids[tag] === undefined){
            this.tag2ids[tag] = [id]
        } else if(this.tag2ids[tag].indexOf(id) < 0){
            this.tag2ids[tag].push(id)
        } else return;

        if(this.id2tags[id] === undefined)
            this.id2tags[id] = [tag]
        else
            this.id2tags[id].push(tag)

        this.idSet.add(id)

        this.write({o: 1, id, tag})
    }

    removeTag(id, tag){
        id = parseInt(id)
        
        if(this.tag2ids[tag] === undefined || this.tag2ids[tag].indexOf(id) < 0)
            return;

        this.tag2ids[tag].splice(this.tag2ids[tag].indexOf(id), 1)
        this.id2tags[id].splice(this.id2tags[id].indexOf(tag), 1)

        if(this.id2tags[id].length < 1)
            this.idSet.delete(id)

        this.write({o: 0, id, tag})
    }

    getByTag(tag){
        return this.tag2ids[tag] || [];
    }

    getTagsById(id){
        return this.id2tags[id] || [];
    }
}

module.exports = Tags