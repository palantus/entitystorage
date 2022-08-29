import path from 'path';
import fs from 'fs';
import Props from './types/props.js'
import Rels from './types/rels.js'
import Tags from './types/tags.js'
import Blobs from './types/blobs.js'
import History from './types/history.js'
import NumberSeq from './types/numberseq.js'
import Search from './search.js'

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

export default class Entity {

  constructor(...args) {

    let isExisting = false;
    if (args && args[0] == "_internal_init_") {
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
        if (name in target) {
          if (name == "constructor")
            return target[name]

          // Handle getters
          let desc = Object.getOwnPropertyDescriptor(p.constructor.prototype, name)
          if (desc && desc.get !== undefined)
            return desc.get.call(p)

          return target[name]
        } else if (name == "tags") {
          return global.EntityStorage.tags.getTagsById(target._id);
        } else if (name == "props") {
          return global.EntityStorage.props.getProps(target._id);
        } else if (name == "blob") {
          return global.EntityStorage.blobs.get(target._id);
        } else if (name == "history") {
          return global.EntityStorage.history.getEntries(target._id);
        } else if (name == "relations" || name == "rels") {
          let rels = { ...global.EntityStorage.rels.getRelations(target._id) }
          Object.keys(rels).map((key, index) => {
            rels[key] = rels[key].map(id => {
              //let e = new target.constructor('_internal_init_'); 
              let e = new Entity('_internal_init_');
              e._id = id;
              return e
            })
          });
          return rels;
        } else if (name == "relationsrev" || name == "relsrev") {
          let rels = { ...global.EntityStorage.rels.getRelationsReverse(target._id) }
          Object.keys(rels).map((key, index) => {
            rels[key] = rels[key].map(id => {
              //let e = new target.constructor('_internal_init_'); 
              let e = new Entity('_internal_init_');
              e._id = id;
              return e
            })
          });
          return rels;
        } else if (name == "related") {
          let rels = { ...global.EntityStorage.rels.getRelations(target._id) }
          Object.keys(rels).map((key, index) => {
            if (rels[key][0]) {
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
      set(obj, prop, value) {
        if (prop == "_id")
          obj._id = value;
        else if (prop == "blob")
          global.EntityStorage.blobs.set(obj._id, value);
        else if (prop in obj && Object.getOwnPropertyDescriptor(p.constructor.prototype, prop).set !== undefined) // Handle setters
          Object.getOwnPropertyDescriptor(p.constructor.prototype, prop).set.call(p, value)
        else
          global.EntityStorage.props.setProp(obj._id, prop, value);
        return true;
      }
    });

    //if(typeof p.initNew === "function" && (args.length != 1 || args[0] !== '_internal_init_')){
    if (typeof p.initNew === "function" && !isExisting) {
      p.initNew.call(p, ...args)
    }
    return p;
  }

  tag(tag, replaceExisting) {
    if (tag === undefined || tag === null)
      return this; // To allow for .tag(addTag ? "tag" : null)
    if (Array.isArray(tag)) {
      if (replaceExisting) {
        for (let t of this.tags.filter(t => !tag.includes(t))) {
          this.removeTag(t)
        }
      }
      return tag.reduce((ret, cur) => this.tag(cur), this)
    }
    global.EntityStorage.tags.addTag(this._id, tag)
    return this;
  }

  rel(related, rel, replaceExisting) {
    if (typeof related !== "object" || !(related instanceof Entity)) {
      if (replaceExisting) {
        this.removeRel(this.related?.[rel], rel)
      }
      return this;
    }

    if (replaceExisting && this.related?.[rel]?._id != related._id) {
      this.removeRel(this.related?.[rel], rel)
    }

    global.EntityStorage.rels.add(this._id, related._id, rel)
    return this;
  }

  prop(prop, value) {
    global.EntityStorage.props.setProp(this._id, prop, value)
    return this;
  }

  setBlob(stream) {
    if(!stream) return this;
    global.EntityStorage.blobs.set(this._id, stream)
    return this;
  }

  openBlob(type = "write", mode = null) {
    if(type == 'write')
      return global.EntityStorage.blobs.openWrite(this._id, mode || 'w+')
    throw "Unsupported mode for blob open"
  }

  removeTag(tag) {
    global.EntityStorage.tags.removeTag(this._id, tag)
    return this;
  }

  removeProp(prop) {
    global.EntityStorage.props.removeProp(this._id, prop)
    return this;
  }

  removeRel(related, rel) {
    if (typeof related !== "object" || !(related instanceof Entity))
      return this;

    global.EntityStorage.rels.remove(this._id, related._id, rel)
    return this;
  }

  removeBlob() {
    global.EntityStorage.blobs.delete(this._id)
    return this;
  }

  delete() {
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

  enableHistory() {
    global.EntityStorage.history.enable(this._id)
    return this;
  }

  clearHistory() {
    global.EntityStorage.history.delete(this._id)
    return this;
  }

  addHistoryEntry(data, timestamp = null) {
    if (timestamp && timestamp.length == 19) timestamp += ".000"
    if (typeof timestamp === "string" && timestamp.length != 23) throw "Invalid custom timestamp for history entry"
    global.EntityStorage.history.addEntry(this._id, "custom", data, false, timestamp)
  }

  static find(filter) {
    return this.search(filter)[0] || null
  }

  static findOrCreate(filter, ...args) {
    return this.find(filter) || new this()
  }

  static search(filter, args) {
    let t = this;
    let entities = global.EntityStorage.search.search(filter, args).map(id => { let e = new this('_internal_init_'); e._id = id; return e; })

    return new Proxy(entities, {
      get: (target, name, receiver) => {
        if (name in target) {
          return target[name]
        } else if (typeof new this('_internal_init_')[name] === "function") {
          return function (...args) {
            target.forEach(e => e[name](...args));
            return this;
          }
        }
      }
    })
  }

  static from(otherEntity) {
    if (!otherEntity || !otherEntity._id) return null;
    let typedEntity = new this('_internal_init_');
    typedEntity._id = otherEntity._id;
    return typedEntity;
  }

  static async init(dataPath) {
    let es = new EntityStorage()
    await es.init(dataPath)
    return {uiPath, uiAPI}
  }
}

export class EntityStorage {

  get nextId() {
    let ret = this._nextId;
    this._nextId++;
    return ret;
  }

  set nextId(id) {
    this._nextId = id;
  }

  async init(dataPath) {
    dataPath = dataPath ? dataPath : "./";

    await fs.promises.mkdir(dataPath, { recursive: true });
    let history = new History(path.resolve(dataPath, "history.data"));

    [this.search, this.tags, this.rels, this.props, this.history, this.blobs, this.numberSeq] = await Promise.all([
      new Search().init(),
      new Tags(path.resolve(dataPath, "tags.data"), history).init(),
      new Rels(path.resolve(dataPath, "rels.data"), history).init(),
      new Props(path.resolve(dataPath, "props.data"), history).init(),
      history.init(),
      new Blobs(dataPath, history).init(),
      new NumberSeq(path.resolve(dataPath, "numberseq.data"), history).init()
    ])

    this._nextId = Math.max(this.tags.getMaxId(), this.rels.getMaxId(), this.props.getMaxId(), this.blobs.getMaxId()) + 1
    global.EntityStorage = this;

    this.indices = {}
  }

  async addIndex(name) {
    let filename = `./indices/${name}.js`;

    try {
      this.indices[name] = new (require(filename))()
      this.indices[name].fill()
    } catch (err) {
      throw "Unknown index: " + name;
    }
  }

  getAllIds() {
    let hrstart;
    if (global.benchmarkSearch === true) {
      hrstart = process.hrtime()
    }
    let res = [...new Set([
      ...this.tags.getAllIds(),
      ...this.rels.getAllIds(),
      ...this.props.getAllIds(),
      ...this.blobs.getAllIds()])
    ];

    if (global.benchmarkSearch === true) {
      let hrend = process.hrtime(hrstart)
      console.info('Returned all ids in %ds %dms', hrend[0], hrend[1] / 1000000)
    }
    return res;
  }
}

Entity.prototype.toString = function () {
  return this._id;
}

export let nextNum = (...args) => global.EntityStorage.numberSeq.num.apply(global.EntityStorage.numberSeq, args)
export let setNum = (...args) => global.EntityStorage.numberSeq.set.apply(global.EntityStorage.numberSeq, args)
export let lastNum = (...args) => global.EntityStorage.numberSeq.last.apply(global.EntityStorage.numberSeq, args)
export let sanitize = (input) => typeof input === "string" ? input.replace(/[^a-zA-ZæøåÆØÅ0-9\-?><=_@&%0/.,;~^*: ]/g, '')
                               : typeof input === "number" ? ""+input
                               : typeof input === "boolean" ? (input?"true":"false")
                               : ""
export let isFilterValid = (input) => /^[a-zA-ZæøåÆØÅ0-9\-?><=_@&%0/.,;~^*: \"\(\)\|!\s]*$/g.test(input)
export let duplicate = entity => {
  if(!entity || !entity._id) return null;
  let newEntity = new Entity();
  for(let tag of entity.tags) newEntity.tag(tag);
  for(let [rel, entities] of Object.entries(entity.rels)) 
    for(let e of entities)
      newEntity.rel(e, rel);
  for(let [name, val] of Object.entries(entity.props)) newEntity.prop(name, val);
  newEntity.setBlob(entity.blob);
  return newEntity;
}
export let uiAPI = (req, res, next) => {
  let query = req.params.query;

  let result = Entity.search(query)
  res.writeHead(200, { 'Content-Type': 'application/json' });
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

export let uiPath = path.join(__dirname, "www");
export {Query as query} from "./tools/query.mjs"