let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");

class Props{
    
    constructor(dbPath){
        this.prop2Id = {}
        this.id2Props = {}
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
            let pv = data.prop + '__' + data.value;
            if(data.o == 1){
                if(this.prop2Id[pv] === undefined)
                    this.prop2Id[pv] = [data.id]
                else if(this.prop2Id[pv].indexOf(data.id) < 0)
                    this.prop2Id[pv].push(data.id)

                if(this.id2Props[data.id] === undefined){
                    this.id2Props[data.id] = {}
                }
                this.id2Props[data.id][data.prop] = data.value;
                
            } else if(this.prop2Id[pv] !== undefined) {
                this.prop2Id[pv].splice(this.prop2Id[pv].indexOf(data.id), 1);
                delete this.id2Props[data.id][data.prop];
            }
        })
        
    }

    getMaxId(){
        return Object.values(this.prop2Id).reduce((max, e) => Math.max(max, Math.max(...e)), 0);
    }

    getAllIds(){
        return Object.values(this.prop2Id).flat();
    }

    setProp(id, prop, value){
        id = parseInt(id)
        let pv = prop + '__' + value;
        if(this.prop2Id[pv] !== undefined && this.prop2Id[pv].indexOf(id) >= 0)
            return;
        
        if(this.prop2Id[pv] === undefined)
            this.prop2Id[pv] = [id]
        else if(this.prop2Id[pv].indexOf(id) < 0)
            this.prop2Id[pv].push(id)
        else return;

        if(this.id2Props[id] === undefined){
            this.id2Props[id] = {}
        }
        this.id2Props[id][prop] = value;

        this.write({o: 1, id, prop, value})
    }

    removeProp(id, prop, value){
        id = parseInt(id)
        let pv = prop + '__' + value;
        if(this.prop2Id[pv] === undefined || this.prop2Id[pv].indexOf(id) < 0)
            return;

        this.prop2Id[pv].splice(this.prop2Id[pv].indexOf(id), 1);
        delete this.id2Props[id][prop];

        this.write({o: 0, id, prop, value})
    }

    getIdsByProp(prop, value){
        let pv = prop + '__' + value;
        return this.prop2Id[pv] || [];
    }

    getProps(id){
        return this.id2Props[id] || {};
    }
}

module.exports = Props