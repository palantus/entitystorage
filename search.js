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
                res1 = this.handleExpression(e.e1)
                res2 = this.handleExpression(e.e2, res1)
                return [...new Set(res2)];
              case "or":
                return [...new Set([...this.handleExpression(e.e1), ...this.handleExpression(e.e2)])]; //union
              case "not":
                return this.getAllIds().filter(id => !this.handleExpression(e.e).includes(id))
              case "token":
                return this.handleToken(e.tag, e.token, fixedStartSet)
            }
          },
          handleToken: function(tag, token, fixedStartSet){
            switch(tag?tag.toLowerCase():undefined){
              case "id":
                return [parseInt(token)]

              case "tag":
                return global.EntityStorage.tags.getByTag(token);
                
              case "prop":
                let [p, v] = token.split("=")
                if(!p) return []
                
                if(v.startsWith("~")){
                  v = v.substr(1).toLowerCase()
                  if(global.EntityStorage.indices.propcontains)
                    return global.EntityStorage.indices.propcontains.word2Ids[v]
                  else
                    return (fixedStartSet?fixedStartSet:global.EntityStorage.props.getAllIds()).filter((id) => (global.EntityStorage.props.getProps(id)[p] || "").toLowerCase().indexOf(v)>=0)
                } else {
                  return global.EntityStorage.props.getIdsByProp(p, v);
                }

              case "rel":
                if(token.indexOf("=") >= 0)
                  return global.EntityStorage.rels.getRelatedReverse(...token.split("="))
                else
                  return global.EntityStorage.rels.getRelatedReverse(parseInt(token))

              case "revrel":
              case "relrev":
                if(token.indexOf("=") >= 0)
                  return global.EntityStorage.rels.getRelated(...token.split("="))
                else
                  return global.EntityStorage.rels.getRelated(parseInt(token))
        
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
        return doSearch.handleExpression(ast);
      }
}

module.exports = Search;