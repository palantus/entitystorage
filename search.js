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
          handleExpression: function(e) {
            switch(e.type){
              case "and":
                return this.handleExpression(e.e1).filter(value => this.handleExpression(e.e2).includes(value))
              case "or":
                return [...new Set([...this.handleExpression(e.e1), ...this.handleExpression(e.e2)])];
              case "not":
                return `(NOT (${this.handleExpression(e.e)}))`
              case "token":
                return this.handleToken(e.tag, e.token)
            }
          },
          handleToken: function(tag, token){
            switch(tag?tag.toLowerCase():undefined){
              case "tag":
                return global.EntityStorage.tags.getByTag(token);
            case "prop":
                let [p, v] = token.split("=")
                if(!p) return []
                return global.EntityStorage.props.getIdsByProp(p, v);

              default:
                return []
            }
          }
        }
        return doSearch.handleExpression(ast);
      }
}

module.exports = Search;