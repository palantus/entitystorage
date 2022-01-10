import WriteHandler from "../tools/writehandler.js";
import ReadHandler from "../tools/readhandler.js";
import optimize from "../tools/optimizer.js";

export default class Relations{
  
  constructor(dbPath, history){
    this.id2Ids = {}
    this.id2IdsNoRel = {}
    this.id2IdsReverse = {}
    this.id2IdsReverseNoRel = {}
    this.idSet = new Set();
    this.dbPath = dbPath || "rels.data"
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
      let id1 = data.id1;
      let id2 = data.id2;
      let rel = data.rel;
      
      if(data.o == 1){
        if(this.id2Ids[id1] === undefined){
          this.id2Ids[id1] = {}
          this.id2IdsNoRel[id1] = []
        }
        if(this.id2Ids[id1][rel] === undefined){
          this.id2Ids[id1][rel] = []
        }
        this.id2Ids[id1][rel].push(id2)
        if(this.id2IdsNoRel[id1].indexOf(id2) < 0){
          this.id2IdsNoRel[id1].push(id2)
        }
        
        // reverse index
        if(this.id2IdsReverse[id2] === undefined){
          this.id2IdsReverse[id2] = {}
          this.id2IdsReverseNoRel[id2] = []
        }
        if(this.id2IdsReverse[id2][rel] === undefined){
          this.id2IdsReverse[id2][rel] = []
        }
        this.id2IdsReverse[id2][rel].push(id1)
        this.id2IdsReverseNoRel[id2].push(id1)
        
        this.idSet.add(id1)
        this.idSet.add(id2)
        
        numInserts++;
      } else if(this.id2Ids[id1] !== undefined) {
        this.id2Ids[id1][rel] = this.id2Ids[id1][rel].filter(id => id != id2)
        if(this.id2Ids[id1][rel].length == 0) {
          delete this.id2Ids[id1][rel];
        }
        
        if(Object.keys(this.id2Ids[id1]).length === 0) {
          delete this.id2Ids[id1];
          this.id2IdsNoRel[id1] = [];
        } else if(Object.values(this.id2Ids[id1]).reduce((total, cur) => total + (cur.includes(id2) ? 1 : 0), 0) == 0){
          this.id2IdsNoRel[id1] = this.id2IdsNoRel[id1].filter(id => id != id2)
        }
        
        if(this.id2IdsNoRel[id1].length == 0) 
          delete this.id2IdsNoRel[id1];
        
        this.id2IdsReverse[id2][rel] = this.id2IdsReverse[id2][rel].filter(id => id != id1)
        if(this.id2IdsReverse[id2][rel].length == 0) {
          delete this.id2IdsReverse[id2][rel];
          if(Object.keys(this.id2IdsReverse[id2]).length < 1) 
            delete this.id2IdsReverse[id2];
        }
        
        if(!this.id2IdsReverse[id2]){
          delete this.id2IdsReverseNoRel[id2];
        } else if(Object.values(this.id2IdsReverse[id2]).reduce((total, cur) => total + (cur.includes(id1) ? 1 : 0), 0) == 0){
          this.id2IdsReverseNoRel[id2] = this.id2IdsReverseNoRel[id2].filter(id => id != id1)
          if(this.id2IdsReverseNoRel[id2].length == 0) 
            delete this.id2IdsReverseNoRel[id2];
        }
        
        if(this.id2IdsNoRel[id1] === undefined && this.id2IdsReverseNoRel[id1] === undefined)
          this.idSet.delete(id1)
        
        if(this.id2IdsNoRel[id2] === undefined && this.id2IdsReverseNoRel[id2] === undefined)
          this.idSet.delete(id2)
        
        numDeletes++;
      }
    })

    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Relations has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, id1 => Object.entries(this.id2Ids[id1]||{}).reduce((res, cur) => {
        let [rel, ids] = cur;
        res.push(...ids.map(id2 => ({o: 1, id1, id2, rel})))
        return res
      }, []))
    }
  }
  
  getMaxId(){
    return Math.max(Object.values(this.id2IdsNoRel).reduce((max, e) => Math.max(max, Math.max(...e)), 0),
    Object.values(this.id2IdsReverseNoRel).reduce((max, e) => Math.max(max, Math.max(...e)), 0));
  }
  
  getAllIds(){
    return this.idSet.values()
  }
  
  add(id1, id2, rel){
    id1 = parseInt(id1)
    id2 = parseInt(id2)
    
    if(!rel || typeof rel !== "string")
      rel = "" //No rel

    rel = rel.toLowerCase();
    
    if(this.id2Ids[id1] !== undefined && this.id2Ids[id1][rel] !== undefined && this.id2Ids[id1][rel].indexOf(id2) >= 0)
      return;
    
    if(this.id2Ids[id1] === undefined){
      this.id2Ids[id1] = {}
      this.id2IdsNoRel[id1] = []
    }
    if(this.id2Ids[id1][rel] === undefined){
      this.id2Ids[id1][rel] = []
    }
    this.id2Ids[id1][rel].push(id2)
    
    if(this.id2IdsNoRel[id1].indexOf(id2) < 0){
      this.id2IdsNoRel[id1].push(id2)
    }
    
    // reverse index
    if(this.id2IdsReverse[id2] === undefined){
      this.id2IdsReverse[id2] = {}
      this.id2IdsReverseNoRel[id2] = []
    }
    if(this.id2IdsReverse[id2][rel] === undefined){
      this.id2IdsReverse[id2][rel] = []
    }
    this.id2IdsReverse[id2][rel].push(id1)
    if(this.id2IdsReverseNoRel[id2].indexOf(id1) < 0){
      this.id2IdsReverseNoRel[id2].push(id1)
    }
    
    this.idSet.add(id1)
    this.idSet.add(id2)
    
    this.history?.addEntry(id1, "rel", {operation: "add", rel, id1, id2})
    this.history?.addEntry(id2, "rel", {operation: "add-rev", rel, id1, id2})
    this.write({o: 1, id1, id2, rel})
  }
  
  remove(id1, id2, rel){
    id1 = parseInt(id1)
    id2 = parseInt(id2)
    if(!rel)
      rel = "" //No rel
    
    if(this.id2Ids[id1] === undefined || this.id2Ids[id1][rel] === undefined || this.id2Ids[id1][rel].indexOf(id2) < 0)
      return;
    
    this.id2Ids[id1][rel] = this.id2Ids[id1][rel].filter(id => id != id2)
    if(this.id2Ids[id1][rel].length == 0){
      delete this.id2Ids[id1][rel];
    }
    
    if(Object.keys(this.id2Ids[id1]).length === 0) {
      delete this.id2Ids[id1];
      this.id2IdsNoRel[id1] = [];
    } else if(Object.values(this.id2Ids[id1]).reduce((total, cur) => total + (cur.includes(id2) ? 1 : 0), 0) == 0){
      this.id2IdsNoRel[id1] = this.id2IdsNoRel[id1].filter(id => id != id2)
    }
    if(this.id2IdsNoRel[id1].length == 0) 
      delete this.id2IdsNoRel[id1];
    
    this.id2IdsReverse[id2][rel] = this.id2IdsReverse[id2][rel].filter(id => id != id1)
    if(this.id2IdsReverse[id2][rel].length == 0) {
      delete this.id2IdsReverse[id2][rel];
      if(Object.keys(this.id2IdsReverse[id2]).length < 1) 
        delete this.id2IdsReverse[id2];
    }
    
    if(!this.id2IdsReverse[id2]){
      delete this.id2IdsReverseNoRel[id2];
    } else if(Object.values(this.id2IdsReverse[id2]).reduce((total, cur) => total + (cur.includes(id1) ? 1 : 0), 0) == 0){
      this.id2IdsReverseNoRel[id2] = this.id2IdsReverseNoRel[id2].filter(id => id != id1)
      if(this.id2IdsReverseNoRel[id2].length == 0) 
        delete this.id2IdsReverseNoRel[id2];
    }
    
    if(this.id2IdsNoRel[id1] === undefined && this.id2IdsReverseNoRel[id1] === undefined)
      this.idSet.delete(id1)
    
    if(this.id2IdsNoRel[id2] === undefined && this.id2IdsReverseNoRel[id2] === undefined)
      this.idSet.delete(id2)
    
    this.history?.addEntry(id1, "rel", {operation: "remove", rel, id1, id2})
    this.history?.addEntry(id2, "rel", {operation: "remove-rev", rel, id1, id2})
    this.write({o: 0, id1, id2, rel})
  }
  
  getRelated(id, rel){
    if(rel){
      return (this.id2Ids[id]||{})[rel] || [];
    } else {
      return this.id2IdsNoRel[id] || [];
    }
  }
  
  getRelatedReverse(id, rel){
    if(rel){
      return (this.id2IdsReverse[id]||{})[rel] || [];
    } else {
      return this.id2IdsReverseNoRel[id] || [];
    }
  }
  
  getRelations(id){
    return this.id2Ids[id] || {};
  }
  
  getRelationsReverse(id){
    return this.id2IdsReverse[id] || {};
  }
}