import fs from "fs";
import path from "path"
import WriteHandler from "../tools/writehandler.js";

export default async function(sourceDB, idSet, idToData){
  let folder = path.dirname(sourceDB).split(path.sep).pop()
  let files = fs.readdirSync(folder)
  await new Promise(r => fs.rename(sourceDB, `${sourceDB}_${files.length}`, (err) => {/*console.log(err); */r()}));
  let exists = await new Promise(r => fs.access(sourceDB, err => r(err ? false : true)))

  if(exists)
    throw `ERROR: Original database file exists during optimization`

  let writeHandler = new WriteHandler(sourceDB);
  for(let id of idSet.values()){
    for(let data of idToData(id)){
      await writeHandler.write(data)
    }
  }
  await writeHandler.flush()
}