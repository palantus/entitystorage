let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");
const optimize = require("../tools/optimizer.js")

class Props{
  
  constructor(dbPath, history){
    this.prop2Id = {}
    this.id2Props = {}
    this.idSet = new Set();
    this.dbPath = dbPath || "props.data"
    this.history = history
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
    let numDeletes = 0, numInserts = 0;
    let rd = new ReadHandler();
    await rd.read(this.dbPath, (data) => {
      let pv;
      let oldPropCasing = this.id2Props[data.id] === undefined ? data.prop
                        : this.id2Props[data.id][data.prop] !== undefined ? data.prop
                        : Object.keys(this.id2Props[data.id]).find(k => k.toLowerCase() == data.prop.toLowerCase()) || data.prop
                        
      if(data.o == 1){
        pv = (data.prop + '__' + (typeof data.value === "string" ? data.value.substr(0, 100) : ""+data.value)).toLowerCase();
        if(this.prop2Id[pv] === undefined)
          this.prop2Id[pv] = [data.id]
        else if(this.prop2Id[pv].indexOf(data.id) < 0)
          this.prop2Id[pv].push(data.id)
        
        if(this.id2Props[data.id] === undefined){
          this.id2Props[data.id] = {}
        }
        if(oldPropCasing !== data.prop){
          delete this.id2Props[data.id][oldPropCasing]
        }
        this.id2Props[data.id][data.prop] = data.value;
        this.idSet.add(data.id)
        
        numInserts++;
      } else {
        
        let value = this.id2Props[data.id][oldPropCasing]
        pv = (data.prop + '__' + (typeof value === "string" ? value.substr(0, 100) : ""+value)).toLowerCase();
        this.prop2Id[pv].splice(this.prop2Id[pv].indexOf(data.id), 1);
        delete this.id2Props[data.id][oldPropCasing];
        if(Object.entries(this.id2Props[data.id]).length === 0)
          this.idSet.delete(data.id)
        numDeletes++;
      }
    })
    
    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Props has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, ((id) => (Object.entries(this.id2Props[id]||{})?.map(([prop, value]) => ({o: 1, id, prop, value})) || [])).bind(this))
    }
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
    }

    let oldCasing = this.id2Props[id][prop] !== undefined ? prop
                  : Object.keys(this.id2Props[id]).find(k => k.toLowerCase() == prop.toLowerCase()) || prop

    // If the casing is the same and old value is the same as the new => ignore
    if(oldCasing === prop && this.id2Props[id][prop] == value){
      return;
    }
    
    if(this.id2Props[id][oldCasing] !== undefined){
      this.removeProp(id, oldCasing, true)
    }
    
    this.id2Props[id][prop] = value;
    this.idSet.add(id)
    
    let pv = (prop + '__' + (typeof value === "string" ? value.substr(0, 100) : ""+value)).toLowerCase();
    if(this.prop2Id[pv] === undefined){
      this.prop2Id[pv] = [id]
    } else if(this.prop2Id[pv].indexOf(id) < 0){
      this.prop2Id[pv].push(id)
    }
    
    this.history?.addEntry(id, "prop", {operation: "set", prop, value})
    this.write({o: 1, id, prop, value})
  }
  
  removeProp(id, prop, ignoreHistory){
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
      if(this.prop2Id[pv].length < 1){
        delete this.prop2Id[pv];
      }
    }
    
    if(ignoreHistory !== true){
      this.history?.addEntry(id, "prop", {operation: "remove", prop})
    }
    this.write({o: 0, id, prop})
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