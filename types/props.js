import WriteHandler from "../tools/writehandler.js"
import ReadHandler from "../tools/readhandler.js"
import optimize from "../tools/optimizer.js"

export default class Props{
  
  constructor(dbPath, history){
    this.prop2Id = new Map()
    this.id2Props = new Map()
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
    this.isReading = true;
    let numDeletes = 0, numInserts = 0;
    let rd = new ReadHandler();
    await rd.read(this.dbPath, (data) => {
      if(data.o == 1){
        this.setProp(data.id, data.prop, data.value)
        numInserts++;
      } else {
        this.removeProp(data.id, data.prop)
        numDeletes++;
      }
    })
    
    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Props has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, ((id) => ([...this.id2Props.get(id)?.entries()].map(([prop, value]) => ({o: 1, id, prop, value})) || [])).bind(this))
    }
    this.isReading = false;
  }
  
  getMaxId(){
    return [...this.idSet].reduce((max, cur) => cur > max ? cur : max, 0);
  }
  
  getAllIds(){
    return this.idSet
  }
  
  setProp(id, prop, value){
    value = value !== undefined ? value : ""
    id = parseInt(id)

    let props = this.id2Props.get(id)

    if(!props){
      props = new Map()
      this.id2Props.set(id, props)
    }

    let oldCasing;
    if(!this.id2Props.has(id))
      oldCasing = prop
    else {
      if(props.has(prop))
        oldCasing = prop
      else
        oldCasing = [...props.entries()].find(([k, v]) => k.toLowerCase() == prop.toLowerCase())?.[0] || prop
    }

    // If the casing is the same and old value is the same as the new => ignore
    if(oldCasing === prop && props.get(prop) == value){
      return;
    }
    
    let oldValue = props.get(oldCasing)

    if(oldCasing !== prop){
      this.removeProp(id, oldCasing, true)
    }
    
    props.set(prop, value)
    this.idSet.add(id)
    
    if(oldValue !== undefined){
      let pvOld = (prop + '__' + (typeof oldValue === "string" ? oldValue.substring(0, 100) : ""+oldValue)).toLowerCase();
      if(this.prop2Id.has(pvOld)){
        let ids = this.prop2Id.get(pvOld)
        ids.delete(id)
        if(ids.size < 1)
          this.prop2Id.delete(pvOld)
      }
    }

    let pv = (prop + '__' + (typeof value === "string" ? value.substring(0, 100) : ""+value)).toLowerCase();
    
    if(this.prop2Id.has(pv))
      this.prop2Id.get(pv).add(id)
    else
      this.prop2Id.set(pv, new Set([id]))
    
    if(!this.isReading){
      this.history?.addEntry(id, "prop", {operation: "set", prop, value})
      this.write({o: 1, id, prop, value})
    }
  }
  
  removeProp(id, prop, ignoreHistory){
    id = parseInt(id)

    if(!this.id2Props.has(id))
      return;

    let props = this.id2Props.get(id)
    let value = props.get(prop)

    props.delete(prop)
    if(props.size < 1){
      this.id2Props.delete(prop)
      this.idSet.delete(id)
    }
    
    let pv = (prop + '__' + (typeof value === "string" ? value.substring(0, 100) : ""+value)).toLowerCase();
    if(this.prop2Id.has(pv)){
      let ids = this.prop2Id.get(pv)
      ids.delete(id)
      if(ids.size < 1)
        this.prop2Id.delete(pv)
    }
    
    if(!this.isReading){
      if(ignoreHistory !== true){
        this.history?.addEntry(id, "prop", {operation: "remove", prop})
      }
      this.write({o: 0, id, prop})
    }
  }
    
  getIdsByProp(prop, value){
    if(value !== undefined){
      let pv = (prop + '__' + (typeof value === "string" ? value.substring(0, 100) : ""+value)).toLowerCase();
      return this.prop2Id.get(pv) || new Set();
    }
    let sw = prop + '__'
    return new Set([...this.prop2Id.keys()].filter(k => k.startsWith(sw)).map(key => [...this.prop2Id.get(key)]).flat())
  }
  
  getProps(id){
    return this.id2Props.has(id) ? Object.fromEntries(this.id2Props.get(id)) : {};
  }
}