import WriteHandler from "../tools/writehandler.js";
import ReadHandler from "../tools/readhandler.js";
import optimize from "../tools/optimizer.js"

export default class Tags{
  
  constructor(dbPath, history){
    this.tag2ids = new Map()
    this.id2tags = new Map()
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
    this.isReading = true;
    let rd = new ReadHandler();
    let numDeletes = 0, numInserts = 0;
    await rd.read(this.dbPath, (data) => {
      if(data.o == 1){
        this.addTag(data.id, data.tag)
        numInserts++;
      } else {
        this.removeTag(data.id, data.tag)
        numDeletes++;
      }
    })
    
    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`Tags has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, ((id) => (this.id2tags.has(id) ? [...this.id2tags.get(id)].map(tag => ({o: 1, id, tag})) : [])).bind(this))
    }
    this.isReading = false;
  }
  
  getMaxId(){
    return [...this.idSet].reduce((max, cur) => cur > max ? cur : max, 0);
  }
  
  getAllIds(){
    return this.idSet
  }
  
  addTag(id, tag){
    id = parseInt(id)
    let tagLower = tag.toLowerCase()

    if(this.tag2ids.has(tagLower)){
      this.tag2ids.get(tagLower).add(id)
    } else {
      this.tag2ids.set(tagLower, new Set([id]))
    }

    if(this.id2tags.has(id)){
      this.id2tags.get(id).add(tag)
    } else {
      this.id2tags.set(id, new Set([tag]))
    }
    
    this.idSet.add(id)

    if(!this.isReading){
      this.history?.addEntry(id, "tag", {operation: "add", tag})
      this.write({o: 1, id, tag})
    }
  }
  
  removeTag(id, tag){
    id = parseInt(id)
    let tagLower = tag.toLowerCase()
    
    let idSet = this.tag2ids.get(tagLower)
    if(idSet) {
      idSet.delete(id)
      if(idSet.size < 1) this.tag2ids.delete(tagLower)
    }

    let tagSet = this.id2tags.get(id)
    if(tagSet) {
      tagSet.delete(tag)
      if(tagSet.size < 1) {
        this.id2tags.delete(id)
        this.idSet.delete(id)
      }
    }

    if(!this.isReading){
      this.history?.addEntry(id, "tag", {operation: "remove", tag})
      this.write({o: 0, id, tag})
    }
  }
  
  getByTag(tag){
    return this.tag2ids?.get(tag.toLowerCase()) || new Set();
  }
  
  getTagsById(id){
    return [...(this.id2tags.get(id) || [])];
  }
}