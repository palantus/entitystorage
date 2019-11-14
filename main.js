"use strict"

let path = require("path")
let Props = require("./types/props")
let Rels = require("./types/rels")
let Tags = require("./types/tags")
let Search = require("./search")

class Entity{
    
    constructor(){
        this._id = global.EntityStorage.nextId
        return new Proxy(this, {
            get(target, name, receiver) {
                if(name in target) {
                    return target[name]
                } else if(name == "tags") {
                    return global.EntityStorage.tags.getTagsById(target._id);
                } else if(name == "relations" || name == "rels") {
                    return global.EntityStorage.rels.getRelations(target._id)
                } else {
                    return global.EntityStorage.props.getProps(target._id)[name]
                }
            },
            set (obj, prop, value){
                if(prop == "_id")
                    obj._id = value;
                else
                    global.EntityStorage.props.setProp(obj._id, prop, value);
                return true;
            }
        });
    }

    tag(tag){
        global.EntityStorage.tags.addTag(this._id, tag)
        return this;
    }

    rel(related, rel){
        if(typeof related !== "object" || !(related instanceof Entity))
            throw "You can only relate entities to other instances of the Entity class"
        global.EntityStorage.rels.add(this._id, related._id, rel)
        return this;
    }

    prop(prop, value){
        global.EntityStorage.props.setProp(this._id, prop, value)
        return this;
    }
    
    static find(filter){
        return this.search(filter)[0] || null
    }

    static search(filter){
        let t = this;
        return global.EntityStorage.search.search(filter).map(id => {let e = new this(); e._id = id; return e;})
    }

    static async init(dataPath){
        await new EntityStorage().init(dataPath);
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
        this.tags = await new Tags(path.resolve(dataPath, "tags.data")).init();
        this.rels = await new Rels(path.resolve(dataPath, "rels.data")).init();
        this.props = await new Props(path.resolve(dataPath, "props.data")).init();
        this.search = await new Search().init();

        this.nextId = Math.max(this.tags.getMaxId(), this.rels.getMaxId(), this.props.getMaxId()) + 1
        global.EntityStorage = this;
    }

    getAllIds(){
        return [...new Set([...this.tags.getAllIds(), ...this.rels.getAllIds(), ...this.props.getAllIds()])];
    }
}

Entity.prototype.toString = function(){
    return this._id;
}

module.exports = Entity