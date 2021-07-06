"use strict"

let path = require("path")
let fs = require("fs")
let Props = require("./types/props")
let Rels = require("./types/rels")
let Tags = require("./types/tags")
let Blobs = require("./types/blobs")
let History = require("./types/history")
let Search = require("./search")

class Entity{
    
    constructor(...args){
        
        let isExisting = false;
        if(args && args[0] == "_internal_init_"){
          isExisting = true;
        } else {
          this._id = global.EntityStorage.nextId
        }
        /*
        if(!args || args.length < 1 || args[0] != "_internal_init_")
          this._id = global.EntityStorage.nextId
        */
        let p = new Proxy(this, {
            get(target, name, receiver) {
                if(name in target) {
                    if(name == "constructor")
                      return target[name]

                    // Handle getters
                    let desc = Object.getOwnPropertyDescriptor(p.constructor.prototype, name)
                    if(desc && desc.get !== undefined)
                      return desc.get.call(p)
                    
                    return target[name]
                } else if(name == "tags") {
                    return global.EntityStorage.tags.getTagsById(target._id);
                } else if(name == "props") {
                    return global.EntityStorage.props.getProps(target._id);
                } else if(name == "blob") {
                    return global.EntityStorage.blobs.get(target._id);
                } else if(name == "history") {
                    return global.EntityStorage.history.getEntries(target._id);
                } else if(name == "relations" || name == "rels") {
                    let rels = {...global.EntityStorage.rels.getRelations(target._id)}
                    Object.keys(rels).map((key, index) => {
                        rels[key] = rels[key].map(id => {
                            //let e = new target.constructor('_internal_init_'); 
                            let e = new Entity('_internal_init_'); 
                            e._id = id;
                            return e
                        })
                      });
                    return rels;
                } else if(name == "relationsrev" || name == "relsrev") {
                    let rels = {...global.EntityStorage.rels.getRelationsReverse(target._id)}
                    Object.keys(rels).map((key, index) => {
                        rels[key] = rels[key].map(id => {
                            //let e = new target.constructor('_internal_init_'); 
                            let e = new Entity('_internal_init_'); 
                            e._id = id;
                            return e
                        })
                      });
                    return rels;
                } else if(name == "related") {
                    let rels = {...global.EntityStorage.rels.getRelations(target._id)}
                    Object.keys(rels).map((key, index) => {
                        if(rels[key][0]){
                            //let e = new target.constructor('_internal_init_'); 
                            let e = new Entity('_internal_init_'); 
                            e._id = rels[key][0];
                            rels[key] = e
                        } else {
                            rels[key] = null;
                        }
                      });
                    return rels;
                } else {
                    return global.EntityStorage.props.getProps(target._id)[name]
                }
            },
            set (obj, prop, value){
                if(prop == "_id")
                    obj._id = value;
                else if(prop == "blob")
                    global.EntityStorage.blobs.set(obj._id, value);
                else if(prop in obj && Object.getOwnPropertyDescriptor(p.constructor.prototype, prop).set !== undefined) // Handle setters
                    Object.getOwnPropertyDescriptor(p.constructor.prototype, prop).set.call(p, value)
                else
                    global.EntityStorage.props.setProp(obj._id, prop, value);
                return true;
            }
        });
        
        //if(typeof p.initNew === "function" && (args.length != 1 || args[0] !== '_internal_init_')){
        if(typeof p.initNew === "function" && !isExisting){
            p.initNew.call(p, ...args)
        }
        return p;
    }

    tag(tag){
        if(tag === undefined || tag === null) 
            return this; // To allow for .tag(addTag ? "tag" : null)
        if(Array.isArray(tag))
            return tag.reduce((ret, cur) => this.tag(cur), this)
        global.EntityStorage.tags.addTag(this._id, tag)
        return this;
    }

    rel(related, rel){
        if(typeof related !== "object" || !(related instanceof Entity))
            return this;

        global.EntityStorage.rels.add(this._id, related._id, rel)
        return this;
    }

    prop(prop, value){
        global.EntityStorage.props.setProp(this._id, prop, value)
        return this;
    }

    setBlob(stream){
        global.EntityStorage.blobs.set(this._id, stream)
        return this;
    }

    removeTag(tag){
        global.EntityStorage.tags.removeTag(this._id, tag)
        return this;
    }

    removeProp(prop){
        global.EntityStorage.props.removeProp(this._id, prop)
        return this;
    }

    removeRel(related, rel){
        if(typeof related !== "object" || !(related instanceof Entity))
            return this;
            
        global.EntityStorage.rels.remove(this._id, related._id, rel)
        return this;
    }

    removeBlob(){
        global.EntityStorage.blobs.delete(this._id)
        return this;
    }

    delete(){
        let rels = this.rels;
        Object.keys(rels).forEach(rel => {
            rels[rel].forEach(e => {
                this.removeRel(e, rel)
            });
        })
        rels = this.relsrev;
        Object.keys(rels).forEach(rel => {
            rels[rel].forEach(e => {
                e.removeRel(this, rel)
            });
        })

        this.tags.forEach(t => this.removeTag(t))
        
        let props = this.props;
        Object.keys(props).forEach(key => {
            this.removeProp(key)
        })

        global.EntityStorage.blobs.delete(this._id)
        global.EntityStorage.history.delete(this._id)
    }

    enableHistory(){
      global.EntityStorage.history.enable(this._id)
      return this;
    }

    clearHistory(){
      global.EntityStorage.history.delete(this._id)
      return this;
    }

    addHistoryEntry(data, timestamp){
      if(timestamp && timestamp.length == 19) timestamp += ".000"
      if(timestamp.length != 23) throw "Invalid custom timestamp for history entry"
      global.EntityStorage.history.addEntry(this._id, "custom", data, false, timestamp)
    }
    
    static find(filter){
        return this.search(filter)[0] || null
    }
    
    static findOrCreate(filter, ...args){
        return this.find(filter) || new this()
    }

    static search(filter, args){
        let t = this;
        let entities = global.EntityStorage.search.search(filter, args).map(id => {let e = new this('_internal_init_'); e._id = id; return e;})

        return new Proxy(entities, {
            get: (target, name, receiver) => {
                if(name in target) {
                    return target[name]
                } else if(typeof new this('_internal_init_')[name] === "function"){
                    return function(...args) {
                        target.forEach(e => e[name](...args));
                        return this;
                    }
                }
            }
        })
    }

    static from(otherEntity){
      if(!otherEntity || !otherEntity._id) return null;
      let typedEntity = new this('_internal_init_'); 
      typedEntity._id = otherEntity._id; 
      return typedEntity;
    }

    static async init(dataPath){
      let es = new EntityStorage()
      await es.init(dataPath)

      return {
          uiPath: path.join(__dirname, "www"),
          uiAPI: (req, res, next) => {
              let query = req.params.query;
              
              let result = Entity.search(query)
              res.writeHead(200, {'Content-Type':'application/json'});
              res.end(JSON.stringify(result.map(e => {
                  return {
                    id: e._id, 
                    props: e.props, 
                    tags: e.tags, 
                    rels: e.rels, 
                    relsrev: req.query?.includeReverse == "true" ? e.relsrev : undefined
                  }
              })));
          }
      }
    }
}

class EntityStorage{
    
    get nextId(){
        let ret = this._nextId;
        this._nextId++;
        return ret;
    }

    set nextId(id){
        this._nextId = id;
    }

    async init(dataPath){
        dataPath = dataPath ? dataPath : "./";

        await fs.promises.mkdir(dataPath, { recursive: true });
        let history = new History(path.resolve(dataPath, "history.data"));

        [this.search, this.tags, this.rels, this.props, this.history, this.blobs] = await Promise.all([
          new Search().init(),
          new Tags(path.resolve(dataPath, "tags.data"), history).init(),
          new Rels(path.resolve(dataPath, "rels.data"), history).init(),
          new Props(path.resolve(dataPath, "props.data"), history).init(),
          history.init(),
          new Blobs(dataPath, history).init()
        ])
        
        this.nextId = Math.max(this.tags.getMaxId(), this.rels.getMaxId(), this.props.getMaxId(), this.blobs.getMaxId()) + 1
        global.EntityStorage = this;

        this.indices = {}
    }

    async addIndex(name){
        let filename = `./indices/${name}.js`;

        try{
            this.indices[name] = new (require(filename))()
            this.indices[name].fill()
        } catch(err){
            throw "Unknown index: " + name;
        }
    }

    getAllIds(){
        let hrstart;
        if(global.benchmarkSearch === true){
            hrstart = process.hrtime()
        }
        let res = [...new Set([...this.tags.getAllIds(), 
                               ...this.rels.getAllIds(), 
                               ...this.props.getAllIds(), 
                               ...this.blobs.getAllIds()])];
        
        if(global.benchmarkSearch === true){
            let hrend = process.hrtime(hrstart)
            console.info('Returned all ids in %ds %dms', hrend[0], hrend[1] / 1000000)
        }
        return res;
    }
}

Entity.prototype.toString = function(){
    return this._id;
}

module.exports = Entity