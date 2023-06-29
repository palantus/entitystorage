import WriteHandler from "../tools/writehandler.js";
import ReadHandler from "../tools/readhandler.js";
import optimize from "../tools/optimizer.js";

export default class Relations{
  
  constructor(dbPath, history){
    this.id2Ids = new Map()
    this.id2IdsNoRel = new Map()
    this.id2IdsReverse = new Map()
    this.id2IdsReverseNoRel = new Map()
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
    this.isReading = true;
    let numDeletes = 0, numInserts = 0;
    let rd = new ReadHandler();
    await rd.read(this.dbPath, (data) => {      
      if(data.o == 1){
        this.add(data.id1, data.id2, data.rel)
        numInserts++;
      } else {
        this.remove(data.id1, data.id2, data.rel)        
        numDeletes++;
      }
    })

    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Relations has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, id1 => [...(this.id2Ids.get(id1)?.entries()||[])].reduce((res, [rel, idSet]) => {
        res.push(...[...idSet].map(id2 => ({o: 1, id1, id2, rel})))
        return res
      }, []))
    }
    this.isReading = false;
  }
  
  getMaxId(){
    return [...this.idSet].reduce((max, cur) => cur > max ? cur : max, 0);
  }
  
  getAllIds(){
    return this.idSet
  }
  
  add(id1, id2, rel){
    id1 = parseInt(id1)
    id2 = parseInt(id2)
    
    if(!rel || typeof rel !== "string")
      rel = "" //No rel

    rel = rel.toLowerCase();
    
    let rel2Ids = this.id2Ids.get(id1)
    if(!rel2Ids){
      rel2Ids = new Map()
      rel2Ids.set(rel, new Set([id2]))
      this.id2Ids.set(id1, rel2Ids)
      this.id2IdsNoRel.set(id1, new Set([id2]))
    } else {
      if(rel2Ids.has(rel))
        rel2Ids.get(rel).add(id2)
      else
        rel2Ids.set(rel, new Set([id2]))

      if(!this.id2IdsNoRel.has(id1))
        this.id2IdsNoRel.set(id1, new Set([id2]))
      else
        this.id2IdsNoRel.get(id1).add(id2)
    }
    
    // reverse index
    let rel2IdsReverse = this.id2IdsReverse.get(id2)
    if(!rel2IdsReverse){
      rel2IdsReverse = new Map()
      rel2IdsReverse.set(rel, new Set([id1]))
      this.id2IdsReverse.set(id2, rel2IdsReverse)
      this.id2IdsReverseNoRel.set(id2, new Set([id1]))
    } else {
      if(rel2IdsReverse.has(rel))
        rel2IdsReverse.get(rel).add(id1)
      else
        rel2IdsReverse.set(rel, new Set([id1]))

      if(!this.id2IdsReverseNoRel.has(id2))
        this.id2IdsReverseNoRel.set(id2, new Set([id1]))
      else
        this.id2IdsReverseNoRel.get(id2).add(id1)
    }

    this.idSet.add(id1)
    this.idSet.add(id2)
    
    if(!this.isReading){
      this.history?.addEntry(id1, "rel", {operation: "add", rel, id1, id2})
      this.history?.addEntry(id2, "rel", {operation: "add-rev", rel, id1, id2})
      this.write({o: 1, id1, id2, rel})
    }
  }
  
  remove(id1, id2, rel){
    id1 = parseInt(id1)
    id2 = parseInt(id2)
    rel = (rel||"").toLowerCase();

    let rel2Ids = this.id2Ids.get(id1)
    if(!rel2Ids) return;

    let ids = rel2Ids.get(rel)
    if(!ids) return;

    ids.delete(id2)
    if(ids.size < 1)
      rel2Ids.delete(rel)
    
    if(rel2Ids.size < 1){
      this.id2Ids.delete(id1)
      this.id2IdsNoRel.delete(id1)
    }
    
    let numRels = [...rel2Ids.entries()].reduce((total, [rel, ids]) => total + (ids.has(id2) ? 1 : 0), 0)
    if(numRels < 1){
      let ids = this.id2IdsNoRel.get(id1)
      if(ids){
        ids?.delete(id2)
        if(ids.size < 1)
          this.id2IdsNoRel.delete(id1)
      }
    }
    
    // Reverse

    let rel2IdsReverse = this.id2IdsReverse.get(id2)
    let idsReverse = rel2IdsReverse.get(rel)
    if(idsReverse){
      idsReverse.delete(id1)
      if(idsReverse.size < 1)
        rel2IdsReverse.delete(rel)
      
      if(rel2IdsReverse.size < 1){
        this.id2IdsReverse.delete(id2)
        this.id2IdsReverseNoRel.delete(id2)
      }
      
      let numRelsReverse = [...rel2Ids.entries()].reduce((total, [rel, ids]) => total + (ids.has(id1) ? 1 : 0), 0)
      if(numRelsReverse < 1){
        let ids = this.id2IdsReverseNoRel.get(id2)
        if(ids){
          ids?.delete(id1)
          if(ids.size < 1)
            this.id2IdsReverseNoRel.delete(id2)
        }
      }
    }

    if(!this.id2Ids.has(id1) && !this.id2IdsReverse.has(id1))
      this.idSet.delete(id1)
    if(!this.id2Ids.has(id2) && !this.id2IdsReverse.has(id2))
      this.idSet.delete(id2)

    if(!this.isReading){
      this.history?.addEntry(id1, "rel", {operation: "remove", rel, id1, id2})
      this.history?.addEntry(id2, "rel", {operation: "remove-rev", rel, id1, id2})
      this.write({o: 0, id1, id2, rel})
    }
  }
  
  getRelated(id, rel){
    id = parseInt(id)
    if(rel){
      return [...(this.id2Ids.get(id)?.get(rel)||[])]
    } else {
      return [...(this.id2IdsNoRel.get(id)||[])];
    }
  }
  
  getRelatedReverse(id, rel){
    id = parseInt(id)
    if(rel){
      return this.id2IdsReverse.get(id)?.get(rel) || new Set()
    } else {
      return this.id2IdsReverseNoRel.get(id) || new Set();
    }
  }
  
  getRelations(id){
    id = parseInt(id)
    return Object.fromEntries([...(this.id2Ids.get(id)?.entries()||[])].map(([rel, ids]) => ([rel, [...ids]])));
  }
  
  getRelationsReverse(id){
    id = parseInt(id)
    return Object.fromEntries([...(this.id2IdsReverse.get(id)?.entries()||[])].map(([rel, ids]) => ([rel, [...ids]])));
  }
}