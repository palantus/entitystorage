# Entity storage

Very simple and fast database solution as an alternative to SQL or document-based storage.

## Sample usage

Note: Better documentation coming :)

```

let Entity = require("../main.js")

await Entity.init("./data");

//Adding new entities with different data:
let e1 = new Entity().tag("test1").tag("test2").prop("type", "T1");
let e2 = new Entity().tag("test2").rel(e1, "related").prop("type", "T2").rel(e1, "test")

// Looking info up
console.log(e1.tags)
console.log(e2.rels)
console.log(e1.type)

// Simple search and find methods
console.log(Entity.search("tag:test1"))
console.log(Entity.search("prop:type=T1"))
console.log(Entity.find("prop:type=T2").rels)

// Set properties directly on object (will be stored)
let e = Entity.find("prop:type=T2");
e.MyProp = "Hello"
console.log(Entity.find("prop:type=T2").MyProp);

// Properties aren't stored on object, but fetched on-demand
let e1 = new Entity().prop("type", 1)
let e2 = Entity.find("prop:type=1")
e2.type = 2
console.log(e1.type) //shows 2

```

## Typed entities

Create a typed entity like this:

```
class Assignment extends Entity{
    
    constructor(num, title, release){
        super();
        this.num = num;
        this.title = title;
        this.release = release;
    }
    
    moveToNextRelease(){
        let cur = parseInt(this.release.substr(1))
        this.release = 'R'+(cur+1)
    }

    static lookup(num){
        return Assignment.find.call(Assignment, "prop:num=" + num)
    }
}
```

It will allow you to do things like:

```
    // Create and store a new assignment
    let a = new Assignment("01234", "Aew assignment", "R55");

    //Look it up again later on:
    a = Assignment.lookup("01234")

    // Call methods on it:
    a.moveToNextRelease();

    // Do any default Entity methods, like setting properties directly (will be stored in database):
    a.documentation = "My documentation"
    
```