import fs from "fs";
import path from "path"
import ReadHandler from "../tools/readhandler.js";

export async function run(){
  console.log("Starting job 'fix_pre_2_0_14_rels'...")

  let files = fs.readdirSync(global.EntityStorage.dataPath)
                .filter(name => name.startsWith("rels.data"))
                .map(name => ({name, idx: name == "rels.data" ? 0 : parseInt(name.substring(10))}))
                .filter(file => !isNaN(file.idx))
                .sort((a, b) => a.idx == 0 ? 1 : b.idx == 0 ? -1 : a.idx < b.idx ? -1 : 1)
  
  console.log("Using the following file order to process relations:")
  console.log(files)

  let splitChar = '^'
  for(let file of files){
    let rd = new ReadHandler();
    file.active = new Set()
    file.deleted = new Set()
    await rd.read(`${global.EntityStorage.dataPath}/${file.name}`, data => {      
      let id = `${data.id1}${splitChar}${data.id2}${splitChar}${data.rel}`
      if(data.o == 1){
        file.active.add(id)
      } else {
        file.active.delete(id)
        file.deleted.add(id)
      }
    })
  }


  let curValuesMissing = new Set()
  for(let [fileIdx, file] of files.entries()){
    if(file.idx == 0) break;

    let nextFile = files[fileIdx+1]

    for(let val of curValuesMissing.values()){
      if(nextFile.deleted.has(val) || nextFile.active.has(val)){
        curValuesMissing.delete(val)
      }
    }

    for(let val of file.active.values()){
      if(!nextFile.active.has(val) && !nextFile.deleted.has(val)){
        //console.log(`File ${file.idx} => ${nextFile.idx}: ${val}`)
        curValuesMissing.add(val)
      }
    }
  }

  if(curValuesMissing.size > 0){
    console.log("Missing the following relations, which will be added:")
    for(let val of curValuesMissing.values()){
      console.log(val)
      let [id1, id2, rel] = val.split(splitChar)
      id1 = parseInt(id1)
      id2 = parseInt(id2)
      global.EntityStorage.rels.write({o: 1, id1, id2, rel})
    }
  } else {
    console.log("No relations are missing :)")
  }

  console.log("Job 'fix_pre_2_0_14_rels' executed!")
}