"use strict"

let SearchQueryParser = require("searchqueryparser")

class Search{

    async init(){
        this.parser = new SearchQueryParser()
        await this.parser.init()
        return this;
    }

    search(query, {last, first, start, end, after, before} = {}){
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
                  let isNotReverse = e.tag.indexOf("..") >= 0 ? true : false;
                  let s = e.tag.split(isNotReverse ? ".." : ".");
                  let tag = s.pop();

                  if(!fixedStartSet){
                    let curSet = this.handleToken(tag, e.token)
                    
                    s.reverse().forEach(rel => {
                      if(isNotReverse)
                        curSet = curSet.map(id => global.EntityStorage.rels.getRelated(id, rel) || null).filter(id => id !== null).flat()
                      else
                        curSet = curSet.map(id => global.EntityStorage.rels.getRelatedReverse(id, rel) || null).filter(id => id !== null).flat()
                    })
                    
                    return curSet;
                  } else {
                    let curIds;
                    let newSet = []
                    let validatedOkIds = new Set();
                    let validatedNoIds = new Set();

                    for(let outerId of fixedStartSet){
                      curIds = [outerId]
                      for(let rel of s){
                        if(curIds.length > 0){
                          let newIds = []
                          for(let id of curIds){
                            if(isNotReverse)
                              newIds.push(global.EntityStorage.rels.getRelatedReverse(id, rel))
                            else
                              newIds.push(global.EntityStorage.rels.getRelated(id, rel))
                          }
                          curIds = newIds.flat();
                        } else {
                          break;
                        }
                      }
                      for(let curId of curIds){
                        if(curId && !validatedNoIds.has(curId)){
                          if(validatedOkIds.has(curId) || this.handleToken(tag, e.token, [curId]).length > 0){
                            newSet.push(outerId)
                            validatedOkIds.add(curId)
                            break;
                          } else {
                            validatedNoIds.add(curId)
                          }
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

              case "*":
                return fixedStartSet || this.getAllIds()

              case "tag":
                if(fixedStartSet)
                  return global.EntityStorage.tags.getByTag(token).filter(id => fixedStartSet.includes(id))
                return global.EntityStorage.tags.getByTag(token);
                
              case "prop":
                res = null;
                
                if(token.indexOf("=^") > 0){
                  let [p, v] = token.split("=^")
                  return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "").toLowerCase().startsWith(v))

                } else if(token.endsWith("^")){
                  let [p, v] = token.slice(0, -1).split("=")
                  return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "").toLowerCase().endsWith(v))

                } else if(token.indexOf("=") > 0){
                  let [p, v] = token.split("=")
                  res = global.EntityStorage.props.getIdsByProp(p, v);

                } else if(token.indexOf("~") > 0){
                  let [p, v] = token.split("~")
                  if(global.EntityStorage.indices.propcontains)
                    res = global.EntityStorage.indices.propcontains.word2Ids[v]
                  else
                    return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (""+(global.EntityStorage.props.getProps(id)[p] || "")).toLowerCase().indexOf(v)>=0)

                } else if(token.indexOf("<") > 0){
                  let [p, v] = token.split("<")
                  return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "") <= v)

                } else if(token.indexOf(">") > 0){
                  let [p, v] = token.split(">")
                  return (fixedStartSet?fixedStartSet:this.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "") >= v)

                } else {
                  return []
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
        
        let res;
        let hrstart

        if(global.benchmarkSearch === true){
          hrstart = process.hrtime()
        }

        if(!query){
          res = []
        } else if(query === "*"){
          res = global.EntityStorage.getAllIds();
        } else {
          query = query.toLowerCase();
          let ast = this.parser.parse(query.trim())
          res = doSearch.handleExpression(ast);
        }

        res = res.sort((a, b) => a < b ? -1 : 1)

        if(global.benchmarkSearch === true){
          let hrstart = process.hrtime()
          let hrend = process.hrtime(hrstart)
          console.info('Searched %d entities in %ds %dms. Found %d results.', doSearch.getAllIds().length, hrend[0], hrend[1] / 1000000, res.length)
        }

        if(first != null && !isNaN(first))
          res = res.slice(0, first)
        if(last != null && !isNaN(last))
          res = res.slice(Math.max(res.length - last, 0))
          
        if((start != null && !isNaN(start)) || (end != null && !isNaN(end))){
          let starIdx = start||0
          let endIdx = end != null ? end : res.length
          res = res.slice(starIdx, endIdx+1)
        }
          
        if(after != null && !isNaN(after))
          res = res.filter(id => id > after)
        if(before != null && !isNaN(before))
          res = res.filter(id => id < before)

        return res;
      }
}

module.exports = Search;