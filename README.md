# Entity storage

Very simple and fast database solution as an alternative to SQL or document-based storage.

It is designed to be fast and easy to use, rather than perfect in terms of reliability. That means that it doesn't conform to ACID properties, because writes are batched some milliseconds after reporting them back as written. Any queries or modification to changed data within that window, works on the new data obviously.

All data of type tags, properties and relations are cached in memory. Blobs aren't, but are indexed in memory and a small amount of data is cached.

Data file is handled as one sequential "history" of data operations, meaning that all modifications are written to the end of the file (keeping the old versions). This improves reliability, because any corruption can be solved by rolling back to before it happened. It is planned that restaring the service will result in the datafiles being compressed (duplicated to new files without old data).

Entities only exists by their properties. If you remove the last tag and it doesn't have anything associated with it, it doesn't exist anymore. You can however assign a tag to it again and thus reviving it.

## Sample usage

Note: Better documentation coming :)

```javascript
let Entity = require("entitystorage")

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

Create a typed entity like the following example. The function initNew will always be called when constructing a new instance with new.

```javascript
class Assignment extends Entity{
    
    initNew(num, title, release){
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

```javascript
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

In search filters it is possible to use AND (space), OR (|) NOT (!) and parentheses operators. This can be combined with search tokens, like "tag:mytab" or "prop:mypro=myval". 

Example:

```javascript
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

If you want to search for a string in a property, you can use "prop:myprop~app".

If you want to search for a range, you can use "prop:myprop<123" and "prop:myprop>123".

If you just want to return all entities, search for "*".

## Stepping through relations

Relations can be steeped through using .related:

```javascript
let a = new Assignment("01234", "New assignment", "R55");
new Assignment("01111", "Test relation", "R12").rel(a, "solvedin")

console.log(Assignment.find("prop:num=01111").related.solvedin.title);
// Outputs "New assignment"

// Can also be used to filter further:
Assignment.search("tag:assignment").filter(a => a.related.solvedin.release == 'R12')
```

Using .relations (or .rels), you get an object with relations in arrays (doesn't assume only one).

## Indices

There are available indices for faster searching.

Currently they are filled on app startup and doesn't stay synchronized, so they are disabled by default. That will change once they are fully synchronized. They can be enabled by calling:

```javascript
await global.EntityStorage.addIndex("propcontains");
```

This will allow searching eg. 60000 forum posts for words (like "tag:post prop:body=~law") to be completed in 0.25ms, as opposed to about 350ms without index. 

## Search result operations

Search results are arrays of entities, but it is actually possible to call Entity methods om them, wich will call them on all entities:

```javascript
// This will tag all results of the search with "greeting" and set property "message" to "Hello world!":
Entity.search("tag:test1").tag("greeting").prop("message", "Hello world!")
```

If you are using subtypes, you can even call subtype methods on them (using example type Assignment from previously):

```javascript
// This will call Assignment instance method "moveToNextRelease" on all results:
Assignment.search("prop:release=R55").moveToNextRelease()
```

## Using relations in search

Relations can also be stepped through in search. By using dot-notation, you can use filters on related entities:

```javascript
let r54 = new Entity().prop("id", "A").tag("release").prop("name", "R54");
let r55 = new Entity().prop("id", "B").tag("release").prop("name", "R55");
let a1  = new Entity().prop("id", "C").tag("assignment").rel(r54, "release")
let a2  = new Entity().prop("id", "D").tag("assignment").rel(r55, "release")
let t1  = new Entity().prop("id", "E").tag("task").rel(a2, "assignment")
let t2  = new Entity().prop("id", "F").tag("task").rel(a1, "assignment")
let t3  = new Entity().prop("id", "G").tag("task").rel(a2, "assignment")

// Searching relations (most used scenario)
let r = Entity.search("tag:task assignment.release.prop:name=R55")
console.log(r.map(e => e.id)) // Outputs [ 'E', 'G' ]

// Searching reverse relations
r = Entity.search("tag:release release..assignment..prop:priority=2")
console.log(r.map(e => e.id)) // Outputs [ 'B']
```

## Removing tags, relations and properties

```javascript
Entity.search("tag:post").removeTag("migrated").removeRel(entityOld, "migrated").removeProp("legacyid")
```

## API

Entity instance methods:
 - `rel(e2, rel)`: Create a relation to e2 (Entity) with type rel (string)
 - `tag(tag)`: Add tag "tag" to entity. Can be an array. null and undefined are ignored.
 - `prop(name, value)`: Set property "name" to "value".
 - `removeRel(e2, rel)`: Remove relation to e2 (Entity) of type rel (string)
 - `removeTag(tag)`: Remove tag "tag".
 - `removeProp(name)`: Remove property "name".
 - `delete()`: delete all information about the entity
 - `setBlob`: set blob. Can be either a stream, a buffer or a string.
 - `rels`: get all relations (object like `{"rel1": [e1, e2], "rel2": [e1]}`)
 - `props`: get all properties as an object (also accessible using .propertyname directly on entity)
 - `tags`: get all tags (array)
 - `blob`: get blob (stream)

Entity static methods:
 - `find(filter)`: Search for filter "filter" and return first result
 - `findOrCreate(filter)`: same as find, but returns a new Entity if none is found
 - `search(filter)`: Search for filter and return all results as an array
 - `init(dataPath)`: Initialize Entity and load data. Remember to use await, as it is async.


 ## Blobs

Blobs can be assigned to an entity. An entity can only have one blob. Reading a blob will result in a Readable stream. When assigning a blob, it can be either a stream, a buffer or a string.

```javascript

// Storing from string
new Entity().tag("file").setBlob("Hello world")
let s2 = Entity.find("tag:file").blob
s2.setEncoding('utf8');
s2.on('data', data => console.log(data))
s2.on('end', () => console.log("Done"))


// Storing from stream
e = new Entity()
e.blob = fs.createReadStream("main.js");

let stream = e.blob
stream.setEncoding('utf8');
stream.on('data', data => console.log(data))
stream.on('end', () => console.log("Done"))
```