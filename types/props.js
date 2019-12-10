let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");

class Props{
    
    constructor(dbPath){
        this.prop2Id = {}
        this.id2Props = {}
        this.idSet = new Set();
        this.dbPath = dbPath || "props.data"
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
            let pv = (data.prop + '__' + (typeof data.value === "string" ? data.value.substr(0, 100) : ""+data.value)).toLowerCase();
            if(data.o == 1){
                if(this.prop2Id[pv] === undefined)
                    this.prop2Id[pv] = [data.id]
                else if(this.prop2Id[pv].indexOf(data.id) < 0)
                    this.prop2Id[pv].push(data.id)

                if(this.id2Props[data.id] === undefined){
                    this.id2Props[data.id] = {}
                }
                this.id2Props[data.id][data.prop] = data.value;
                this.idSet.add(data.id)
                
            } else if(this.prop2Id[pv] !== undefined) {
                this.prop2Id[pv].splice(this.prop2Id[pv].indexOf(data.id), 1);
                delete this.id2Props[data.id][data.prop];

                if(Object.entries(this.id2Props[data.id]).length === 0)
                    this.idSet.delete(data.id)
            }
        })
        
    }

    getMaxId(){
        return Object.values(this.prop2Id).reduce((max, e) => Math.max(max, Math.max(...e)), 0);
    }

    getAllIds(){
        return this.idSet.values()
    }

    setProp(id, prop, value){
        value = value !== undefined ? value : ""
        id = parseInt(id)

        if(this.id2Props[id] === undefined){
            this.id2Props[id] = {}
        } else if(this.id2Props[id][prop] == value){
            return;
        }

        this.id2Props[id][prop] = value;
        this.idSet.add(id)

        let pv = (prop + '__' + (typeof value === "string" ? value.substr(0, 100) : ""+value)).toLowerCase();
        if(this.prop2Id[pv] === undefined){
            this.prop2Id[pv] = [id]
        } else if(this.prop2Id[pv].indexOf(id) < 0){
            this.prop2Id[pv].push(id)
        }

        this.write({o: 1, id, prop, value})
    }

    removeProp(id, prop){
        id = parseInt(id)
        let value = this.id2Props[id][prop]

        if(value === undefined)
            return;
            
        delete this.id2Props[id][prop];
        if(Object.entries(this.id2Props[id]).length === 0)
            this.idSet.delete(id)

        let pv = (prop + '__' + (typeof value === "string" ? value.substr(0, 100) : ""+value)).toLowerCase();
        if(this.prop2Id[pv] !== undefined && this.prop2Id[pv].indexOf(id) >= 0){
            this.prop2Id[pv].splice(this.prop2Id[pv].indexOf(id), 1);
        }

        this.write({o: 0, id, prop, value})
    }

    getIdsByProp(prop, value){
        let pv = (prop + '__' + (typeof value === "string" ? value.substr(0, 100) : ""+value)).toLowerCase();
        return this.prop2Id[pv] || [];
    }

    getProps(id){
        return this.id2Props[id] || {};
    }
}

module.exports = Props