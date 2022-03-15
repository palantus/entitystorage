import Entity from "../main.js"

export class Query{
  _results = null
  _type = Entity

  constructor(){

  }

  static tag(...args){return new Query().tag(...args)}
  static prop(...args){return new Query().prop(...args)}
  static id(...args){return new Query().id(...args)}
  static type(...args){return new Query().type(...args)}
  static not(...args){return new Query().not(...args)}

  tag(tag){
    if(this._results !== null) return this.and(new Query().tag(tag))
    this._results = global.EntityStorage.tags.getByTag(tag)
    return this;
  }

  prop(prop, value){
    if(this._results !== null) return this.and(new Query().prop(prop, value))
    this._results = global.EntityStorage.props.getIdsByProp(prop, value)
    return this;
  }

  id(id){
    if(this._results !== null) return this.and(new Query().id(id))
    if(global.EntityStorage.props.idSet.has(id)
      || global.EntityStorage.tags.idSet.has(id)
      || global.EntityStorage.rels.idSet.has(id)
      || global.EntityStorage.blobs.idSet.has(id)){
      this._results = new Set([id])
    } else {
      this._results = new Set()
    }
    return this
  }

  not(q2){
    if(this._results == null || this._results.size < 1){
      this._results = new Set();
    } else if(q2 && q2._results != null && q2._results.size > 0){
      this._results = [...this._results].filter(id => !q2._results.has(id))
    } 
    return this;
  }

  type(type){
    this._type = type
    return this;
  }

  and(q2){
    if(this._results === null) {
      this._results = q2._results || [];
    } else if(q2._results === null){
      this._results = this._results
    } else if(this._results.size > q2._results.size){
      this._results = [...q2._results].filter(id => this._results.has(id))
    } else {
      this._results = [...this._results].filter(id => q2._results.has(id))
    }

    return this;
  }

  or(q2){
    if(this._results === null) {
      this._results = q2._results || [];
    } else if(q2._results === null){
      this._results = this._results
    } else {
      this._results = new Set([...this._results, ...q2._results])
    }
    return this;
  }

  get first(){
    if(this._results === null || this._results.size < 1) return null;
    let e = new this._type('_internal_init_'); 
    e._id = this._results.values().next().value; 
    return e;
  }

  get all(){
    return this._results ? [...this._results].map(id => { let e = new this._type('_internal_init_'); e._id = id; return e; }) : []
  }

  get ids(){
    return this._results || new Set()
  }

  get exists(){
    return this._results ? this._results.size > 0 : false
  }

  get count(){
    return this._results ? this._results.size : 0
  }
}