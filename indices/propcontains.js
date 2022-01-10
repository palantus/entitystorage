import Entity from "../main.js"

export default class PropIndex{
    constructor(){
        this.word2Ids = {}
    }

    fill(){
        console.log("Beginning to build prop index")
        let allIds = global.EntityStorage.props.getAllIds()
        for(let id of allIds){
            let props = global.EntityStorage.props.getProps(id)
            
            for (let [key, value] of Object.entries(props)) {
                if(typeof value !== "string")
                    continue;

                for(let word of value.toLowerCase().replace(/[\|&;\$%@"<>\(\)\+\*,\.\r\n/\t\-\=\:\?]/g, " ").split(" ").filter((w) => w ? true : false)){
                    if(this.word2Ids[word] === undefined)
                        this.word2Ids[word] = [id]
                    else if(this.word2Ids[word].indexOf(id) < 0)
                        this.word2Ids[word].push(id)
                }
            }
        }
        console.log("Finished building prop index")
    }
}