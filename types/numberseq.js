import WriteHandler from "../tools/writehandler.js";
import ReadHandler from "../tools/readhandler.js";
import optimize from "../tools/optimizer.js"

export default class NumberSeq {

  constructor(dbPath) {
    this.dbPath = dbPath || "./"
    this.context2Num = {}
  }

  async init() {
    await this.readIndexFile()
    return this;
  }

  async write(data) {
    if (this.writeHandler === undefined)
      this.writeHandler = new WriteHandler(this.dbPath);

    await this.writeHandler.write(data)
  }

  async readIndexFile() {
    let rd = new ReadHandler();
    let numRecords = 0;
    await rd.read(this.dbPath, (data) => {
      this.context2Num[data.key] = data.id
      numRecords++;
    })

    if(numRecords / Object.keys(this.context2Num).length > 1000){
      console.log(`Number sequences has more than 1000 numbers per key. Optimizing the file.`)
      let keySet = new Set(Object.keys(this.context2Num));
      await optimize(this.dbPath, keySet, ((key) => ([{key, id: this.context2Num[key]}])).bind(this))
    }
  }

  num(context) {
    let key = (typeof context) === "string" && context ? context : ""
    let id = this.context2Num[key] = (this.context2Num[key] || -1) + 1;
    if(!id){
      id = this.context2Num[key] = 1
    }
    this.write({ key, id })
    return id;
  }
  
  last(context){
    let key = (typeof context) === "string" && context ? context : ""
    return this.context2Num[key] || null
  }
}