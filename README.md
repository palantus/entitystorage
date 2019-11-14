# Entity storage

Very simple and fast database solution as an alternative to SQL or document-based storage.

It is designed to be fast and easy to use, rather than perfect in terms of reliability. That means that it doesn't conform to ACID properties, because writes are batched some milliseconds after reporting them back as written. Any queries or modification to changed data within that window, works on the new data obviously.

All data of type tags, properties and relations are cached in memory. Blobs aren't, but are indexed in memory and a small amount of data is cached.

Data file is handled as one sequential "history" of data operations, meaning that all modifications are written to the end of the file (keeping the old versions). This improves reliability, because any corruption can be solved by rolling back to before it happened. It is planned that restaring the service will result in the datafiles being compressed (duplicated to new files without old data).

Entities only exists by their properties. If you remove the last tag and it doesn't have anything associated with it, it doesn't exist anymore. You can however assign a tag to it again and thus reviving it.

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

## Searching

In search filters it is possible to use AND (space), OR (|) and NOT (!) operators. This can be combined with search tokens, like "tag:mytab" or "prop:mypro=myval". 

Example:

```
await Entity.init("./data");
    
let a = new Entity().prop("id", "A").tag("test1").tag("test2").prop("type", "T1");
let b = new Entity().prop("id", "B").tag("test2").prop("type", "T2")
let c = new Entity().prop("id", "C").tag("test2").prop("type", "T2")
let d = new Entity().prop("id", "D").tag("test1").prop("type", "T3").rel(a)

console.log(Entity.search("tag:test2 (!tag:test1|prop:type=T3)").map(e => e.id))
//Outputs [ 'B', 'C' ]

console.log(Entity.search(`rel:${d}`).map(e => e.id))
// Outputs [ 'A' ]
```

Relations can be searched using "rel:entity=relationname" where "=relationname" is optional. It will find all entities which has a relation to the entity with the given (optional) relation name.  Reverse relations (ie. find entities which the chosen entity has relations to), can be searched for using "relrev:entity=relationname".

If you want to search for a word in a property, you can use "prop:myprop=~app".