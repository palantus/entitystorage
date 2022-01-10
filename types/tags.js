import WriteHandler from "../tools/writehandler.js";
import ReadHandler from "../tools/readhandler.js";
import optimize from "../tools/optimizer.js"

export default class Tags{
  
  constructor(dbPath, history){
    this.tag2ids = {}
    this.id2tags = {}
    this.idSet = new Set();
    this.dbPath = dbPath || "tags.data"
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
    let rd = new ReadHandler();
    let numDeletes = 0, numInserts = 0;
    await rd.read(this.dbPath, (data) => {
      let id = data.id
      let tag = data.tag
      let tagLower = tag.toLowerCase()
      
      if(data.o == 1){
        if(this.tag2ids[tagLower] === undefined){
          this.tag2ids[tagLower] = [id]
        } else if(this.tag2ids[tagLower].indexOf(id) < 0){
          this.tag2ids[tagLower].push(id)
        } else return;
        
        if(this.id2tags[id] === undefined)
          this.id2tags[id] = [tag]
        else
          this.id2tags[id].push(tag)
        
        this.idSet.add(id)
        numInserts++;
      } else if(this.tag2ids[tagLower] !== undefined) {
        this.tag2ids[tagLower] = this.tag2ids[tagLower].filter(i => i != id)
        this.id2tags[id] = this.id2tags[id].filter(t => t != tag);
        
        if(this.id2tags[id].length < 1){
          this.idSet.delete(id);
          delete this.id2tags[id];
        }

        if(this.tag2ids[tagLower].length < 1){
          delete this.tag2ids[tagLower];
        }
        
        numDeletes++;
      }
    })
    
    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Tags has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, ((id) => (this.id2tags[id]?.map(tag => ({o: 1, id, tag})) || [])).bind(this))
    }
  }
  
  getMaxId(){
    return Object.values(this.tag2ids).reduce((max, e) => Math.max(max, Math.max(...e)), 0);
  }
  
  getAllIds(){
    return this.idSet.values()
  }
  
  addTag(id, tag){
    id = parseInt(id)
    let tagLower = tag.toLowerCase()
    
    if(this.tag2ids[tagLower] !== undefined && this.tag2ids[tagLower].indexOf(id) >= 0)
      return;
    
    if(this.tag2ids[tagLower] === undefined){
      this.tag2ids[tagLower] = [id]
    } else if(this.tag2ids[tagLower].indexOf(id) < 0){
      this.tag2ids[tagLower].push(id)
    } else return;
    
    if(this.id2tags[id] === undefined)
      this.id2tags[id] = [tag]
    else
      this.id2tags[id].push(tag)
    
    this.idSet.add(id)
    
    this.history?.addEntry(id, "tag", {operation: "add", tag})
    this.write({o: 1, id, tag})
  }
  
  removeTag(id, tag){
    id = parseInt(id)
    let tagLower = tag.toLowerCase()
    
    if(this.tag2ids[tagLower] === undefined || this.tag2ids[tagLower].indexOf(id) < 0)
      return;
    
    this.tag2ids[tagLower] = this.tag2ids[tagLower].filter(i => i != id)
    this.id2tags[id] = this.id2tags[id].filter(t => t != tag);
    
    if(this.id2tags[id].length < 1){
      this.idSet.delete(id)
      delete this.id2tags[id];
    }

    if(this.tag2ids[tagLower].length < 1){
      delete this.tag2ids[tagLower];
    }
    
    this.history?.addEntry(id, "tag", {operation: "remove", tag})
    this.write({o: 0, id, tag})
  }
  
  getByTag(tag){
    return this.tag2ids[tag.toLowerCase()] || [];
  }
  
  getTagsById(id){
    return this.id2tags[id] || [];
  }
}