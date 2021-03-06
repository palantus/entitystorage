let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");
const optimize = require("../tools/optimizer.js")

class History{
  
  constructor(dbPath){
    this.id2History = {}
    this.idSet = new Set();
    this.dbPath = dbPath || "history.data"
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
      if(data.o == 1){
        if(this.id2History[data.id] === undefined){
          this.id2History[data.id] = []
        }
        this.id2History[data.id].push({type: data.type, data: data.data, ts: data.ts})
        this.idSet.add(data.id)
        numInserts++;
      } else {
        delete this.id2History[data.id];
        this.idSet.delete(data.id)
        numDeletes++;
      }
    })
    
    if(numDeletes / numInserts > 0.2 && numDeletes > 1000){
      console.log(`History has a delete-to-insert ratio of ${numDeletes / numInserts}. Optimizing the file.`)
      await optimize(this.dbPath, this.idSet, ((id) => (this.id2History[id]?.map(data => ({o: 1, id, data})) || [])).bind(this))
    }
  }
  
  getMaxId(){
    return Array.from(this.idSet).reduce((max, e) => Math.max(max, e), 0);
  }
  
  getAllIds(){
    return this.idSet.values()
  }

  isEnabled(id){
    return this.idSet.has(id)
  }

  enable(id){
    if(this.idSet.has(id)) return;
    this.addEntry(id, "enable", null, true)
  }
  
  addEntry(id, type, data = null, force = false, timestamp = null){
    if(!force && !this.idSet.has(id)) return;
    let ts = timestamp || this.getTimestamp();
    if(this.id2History[id] === undefined){
      this.id2History[id] = []
    }
    this.id2History[id].push({type: type, data, ts})
    this.idSet.add(id)
    this.write({o: 1, id, type, data, ts})
  }

  getEntries(id){
    return this.id2History[id] ?? []
  }

  getFirstEntry(id){
    return this.id2History[id]?.reduce((first, cur) => cur.ts < first?.ts||"9999" ? cur : first, null) || null
  }

  getLastEntry(id){
    return this.id2History[id]?.reduce((last, cur) => cur.ts > last?.ts||"0000" ? cur : last, null) || null
  }

  delete(id){
    delete this.id2History[id];
    this.idSet.delete(id)
    this.write({o: 0, id})
  }

  getTimestamp() {
    let tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
  }
}

module.exports = History