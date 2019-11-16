"use strict"

let SearchQueryParser = require("searchqueryparser")

class Search{

    async init(){
        this.parser = new SearchQueryParser()
        await this.parser.init()
        return this;
    }

    search(query){
        if(!query) return []
        let ast = this.parser.parse(query.trim())
    
        let doSearch = {
          handleExpression: function(e, fixedStartSet) {
            let res1;
            let res2;

            switch(e.type){
              case "and":
                res1 = this.handleExpression(e.e1, fixedStartSet)
                res2 = this.handleExpression(e.e2, res1)
                return [...new Set(res2)];
              case "or":
                return [...new Set([...this.handleExpression(e.e1, fixedStartSet), ...this.handleExpression(e.e2, fixedStartSet)])]; //union
              case "not":
                let notStartSet = fixedStartSet ? fixedStartSet : this.getAllIds()
                let exceptSet = this.handleExpression(e.e, notStartSet);
                return notStartSet.filter(id => !exceptSet.includes(id))
              case "token":
                if(e.tag && e.tag.indexOf(".") >= 0){

                  if(!fixedStartSet){
                    let s = e.tag.split(".")
                    let curSet = this.handleToken(s.pop(), e.token)
                    s.reverse().forEach(rel => {
                      curSet = curSet.map(id => global.EntityStorage.rels.getRelatedReverse(id, rel) || null).filter(id => id !== null).flat()
                    })
                    
                    return curSet;
                  } else {
                    let s = e.tag.split(".")
                    let tag = s.pop()
                    let curId;
                    let newSet = []
                    let validatedOkIds = new Set();
                    let validatedNoIds = new Set();

                    for(let outerId of fixedStartSet){
                      curId = outerId
                      for(let rel of s){
                        if(curId){
                          curId = global.EntityStorage.rels.getRelated(curId, rel)[0]
                        } else {
                          break;
                        }
                      }
                      if(curId && !validatedNoIds.has(curId)){
                        if(validatedOkIds.has(curId) || this.handleToken(tag, e.token, [curId]).length > 0){
                          newSet.push(outerId)
                          validatedOkIds.add(curId)
                        } else {
                          validatedNoIds.add(curId)
                        }
                      }
                    }
                    
                    return newSet
                  }
                }
                return this.handleToken(e.tag, e.token, fixedStartSet)
            }
          },
          handleToken: function(tag, token, fixedStartSet){
            let res;

            switch(tag?tag.toLowerCase():undefined){
              case "id":
                let id = parseInt(token);
                if(fixedStartSet)
                  return fixedStartSet.indexOf(id) >= 0 ? [id] : []
                return [id]

              case "tag":
                if(fixedStartSet)
                  return global.EntityStorage.tags.getByTag(token).filter(id => fixedStartSet.includes(id))
                return global.EntityStorage.tags.getByTag(token);
                
              case "prop":
                let [p, v] = token.split("=")
                if(!p) return []
                
                res = null;
                if(v.startsWith("~")){
                  v = v.substr(1).toLowerCase()
                  if(global.EntityStorage.indices.propcontains)
                    res = global.EntityStorage.indices.propcontains.word2Ids[v]
                  else
                    return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "").toLowerCase().indexOf(v)>=0)
                } else {
                  res = global.EntityStorage.props.getIdsByProp(p, v);
                }
                return fixedStartSet ? res.filter(id => fixedStartSet.includes(id)) : res;

              case "rel":
                if(token.indexOf("=") >= 0)
                  res = global.EntityStorage.rels.getRelatedReverse(...token.split("="))
                else
                  res = global.EntityStorage.rels.getRelatedReverse(parseInt(token))
                return fixedStartSet ? res.filter(id => fixedStartSet.includes(id)) : res;

              case "revrel":
              case "relrev":
                if(token.indexOf("=") >= 0)
                  res = global.EntityStorage.rels.getRelated(...token.split("="))
                else
                  res = global.EntityStorage.rels.getRelated(parseInt(token))
                return fixedStartSet ? res.filter(id => fixedStartSet.includes(id)) : res;
        
              default:
                return []
            }
          },
          getAllIds(){
            if(!this.allIds)
              this.allIds = global.EntityStorage.getAllIds();
            return this.allIds;
          }
        }
        
        if(global.benchmarkSearch === true){
          let hrstart = process.hrtime()
          let res = doSearch.handleExpression(ast);
          let hrend = process.hrtime(hrstart)
          console.info('Searched %d entities in %ds %dms. Found %d results.', doSearch.getAllIds().length, hrend[0], hrend[1] / 1000000, res.length)
          return res;

        }
        return doSearch.handleExpression(ast);
      }
}

module.exports = Search;