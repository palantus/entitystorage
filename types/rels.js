let WriteHandler = require("../tools/writehandler.js");
let ReadHandler = require("../tools/readhandler.js");

class Relations{
    
    constructor(dbPath){
        this.id2Ids = {}
        this.id2IdsNoRel = {}
        this.id2IdsReverse = {}
        this.id2IdsReverseNoRel = {}
        this.dbPath = dbPath || "rels.data"
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
        await rd.read(this.dbPath, (data) => {
            let id1 = data.id1;
            let id2 = data.id2;
            let rel = data.rel;

            if(data.o == 1){
                if(this.id2Ids[id1] === undefined){
                    this.id2Ids[id1] = {}
                    this.id2IdsNoRel[id1] = []
                }
                if(this.id2Ids[id1][rel] === undefined){
                    this.id2Ids[id1][rel] = []
                }
                this.id2Ids[id1][rel].push(id2)
                if(this.id2IdsNoRel[id1].indexOf(id2) < 0){
                    this.id2IdsNoRel[id1].push(id2)
                }
        
                // reverse index
                if(this.id2IdsReverse[id2] === undefined){
                    this.id2IdsReverse[id2] = {}
                    this.id2IdsReverseNoRel[id2] = []
                }
                if(this.id2IdsReverse[id2][rel] === undefined){
                    this.id2IdsReverse[id2][rel] = []
                }
                this.id2IdsReverse[id2][rel].push(id1)
                this.id2IdsReverseNoRel[id2].push(id1)
                
            } else if(this.prop2Id[pv] !== undefined) {
                this.id2Ids[id1][rel].splice(this.id2Ids[id1][rel].indexOf(id2), 1);
                this.id2IdsNoRel[id1].splice(this.id2IdsNoRel[id1].indexOf(id2), 1);
                
                this.id2IdsReverse[id2][rel].splice(this.id2IdsReverse[id2][rel].indexOf(id1), 1);
                this.id2IdsReverseNoRel[id2].splice(this.id2IdsReverseNoRel[id2].indexOf(id1), 1);
            }
        })
        
    }

    getMaxId(){
        return Math.max(Object.values(this.id2IdsNoRel).reduce((max, e) => Math.max(max, Math.max(...e)), 0),
                        Object.values(this.id2IdsReverseNoRel).reduce((max, e) => Math.max(max, Math.max(...e)), 0));
    }

    getAllIds(){
        return [...new Set([...Object.values(this.id2IdsNoRel), ...Object.values(this.id2IdsReverseNoRel)])].flat();
    }

    add(id1, id2, rel){
        id1 = parseInt(id1)
        id2 = parseInt(id2)

        if(!rel)
            rel = "" //No rel

        if(this.id2Ids[id1] !== undefined && this.id2Ids[id1][rel] !== undefined && this.id2Ids[id1][rel].indexOf(id2) >= 0)
            return;

        if(this.id2Ids[id1] === undefined){
            this.id2Ids[id1] = {}
            this.id2IdsNoRel[id1] = []
        }
        if(this.id2Ids[id1][rel] === undefined){
            this.id2Ids[id1][rel] = []
        }
        this.id2Ids[id1][rel].push(id2)

        if(this.id2IdsNoRel[id1].indexOf(id2) < 0){
            this.id2IdsNoRel[id1].push(id2)
        }

        // reverse index
        if(this.id2IdsReverse[id2] === undefined){
            this.id2IdsReverse[id2] = {}
            this.id2IdsReverseNoRel[id2] = []
        }
        if(this.id2IdsReverse[id2][rel] === undefined){
            this.id2IdsReverse[id2][rel] = []
        }
        this.id2IdsReverse[id2][rel].push(id1)
        if(this.id2IdsReverseNoRel[id2].indexOf(id1) < 0){
            this.id2IdsReverseNoRel[id2].push(id1)
        }

        this.write({o: 1, id1, id2, rel})
    }

    remove(id1, id2, rel){
        id1 = parseInt(id1)
        id2 = parseInt(id2)
        if(!rel)
            rel = "" //No rel

        if(this.id2Ids[id1] === undefined || this.id2Ids[id1][rel] === undefined || this.id2Ids[id1][rel].indexOf(id2) < 0)
            return;

        this.id2Ids[id1][rel].splice(this.id2Ids[id1][rel].indexOf(id2), 1);
        this.id2IdsNoRel[id1].splice(this.id2IdsNoRel[id1].indexOf(id2), 1);
        
        this.id2IdsReverse[id2][rel].splice(this.id2IdsReverse[id2][rel].indexOf(id1), 1);
        this.id2IdsReverseNoRel[id2].splice(this.id2IdsReverseNoRel[id2].indexOf(id1), 1);
        
        this.write({o: 0, id1, id2, rel})
    }

    getRelated(id, rel){
        if(rel){
            return (this.id2Ids[id]||{})[rel] || [];
        } else {
            return this.id2IdsNoRel[id] || [];
        }
    }

    getRelatedReverse(id, rel){
        if(rel){
            return (this.id2IdsReverse[id]||{})[rel] || [];
        } else {
            return this.id2IdsReverseNoRel[id] || [];
        }
    }

    getRelations(id){
        return this.id2Ids[id] || {};
    }
}

module.exports = Relations