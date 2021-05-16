const fs = require("fs");
const path = require("path")
const WriteHandler = require("../tools/writehandler.js");
const ReadHandler = require("../tools/readhandler.js");

module.exports = async function(sourceDB, idSet){
  try{fs.unlinkSync(sourceDB + "_new")}catch(err){}
  let writeHandler = new WriteHandler(sourceDB + "_new");
  let rd = new ReadHandler();
  await rd.read(sourceDB, async (data) => {
    if(data.o == 1 && idSet.has(data.id)){
      await writeHandler.write(data)
    }
  })
  await writeHandler.flush()
  let folder = path.dirname(sourceDB).split(path.sep).pop()
  let files = fs.readdirSync(folder)
  await new Promise(r => fs.rename(sourceDB, `${sourceDB}_${files.length}`, (err) => {console.log(err); r()}));
  await new Promise(r => fs.rename(sourceDB + "_new", sourceDB, (err) => {console.log(err); r()}));
}