# Entity storage

Very simple and fast database solution as an alternative to SQL or document-based storage.

It is designed to be fast and easy to use, rather than perfect in terms of reliability. That means that it doesn't conform to ACID properties, because writes are batched some milliseconds after reporting them back as written. Any queries or modification to changed data within that window, works on the new data obviously.

All data of type tags, properties and relations are cached in memory. Blobs aren't, but are indexed in memory and a small amount of data is cached.

Data file is handled as one sequential "history" of data operations, meaning that all modifications are written to the end of the file (keeping the old versions). This improves reliability, because any corruption can be solved by rolling back to before it happened. It is planned that restaring the service will result in the datafiles being compressed (duplicated to new files without old data).

Entities only exists by their properties. If you remove the last tag and it doesn't have anything associated with it, it doesn't exist anymore. You can however assign a tag to it again and thus reviving it.

## Sample usage

Note: Better documentation coming :)

```javascript
import Entity from "entitystorage"

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

It is also possible to override eg. delete, to remove any other entities for cleaning up:

```javascript
class My extends Entity{
  delete(){
    this.rels.logentry.forEach(e => e.delete());
    super.delete()
  }
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

console.log(Entity.search(`rel:${a}`).map(e => e.id))
// Outputs [ 'D' ]
```

Relations can be searched using "rel:entity=relationname" where "=relationname" is optional. It will find all entities which has a relation to the entity with the given (optional) relation name.  Reverse relations (ie. find entities which the chosen entity has relations to), can be searched for using "relrev:entity=relationname".

If you want to search for a string in a property, you can use "prop:myprop~app".

If you want to search for a range, you can use "prop:myprop<123" and "prop:myprop>123".

If you just want to return all entities, search for "*".

If you want to search for a property starting or ending with a specific string, use the caret (^) symbol. (eg. "prop:type=^T" for starting with T and "prop:type=T^" for ending with T).

If you want to search for entities missing a property, use "!prop:test".

## Pagination

Search results are always sorted by their internal id (insert order) and the order is therefore guaranteed not to change on later searches. The "search" function has an optional second argument called args, which accepts the following properties:

 - `first`: Integer. Results includes the "first" number of results from the result-set from the beginning of the array.
 - `last`: Integer. Results includes the "last" number of results from the result-set from the end of the array.
 - `start`: Integer. Results start at index "start" (including).
 - `end`: Integer. Results end at index "end" (including).
 - `after`: Integer. Results with a higher id than the provided (id's can be extracted using entity._id)
 - `before`: Integer. Results with a lower id than the provided (id's can be extracted using entity._id)

It is recommended to do pagination using the above properties instead of eg. "slice", because using slice will prevent you from calling eg. ".tag()" on the array afterwards.

## Stepping through relations

Relations can be stepped through using .related:

```javascript
let a = new Assignment("01234", "New assignment", "R55");
new Assignment("01111", "Test relation", "R12").rel(a, "solvedin")

console.log(Assignment.find("prop:num=01111").related.solvedin.title);
// Outputs "New assignment"

// Can also be used to filter further:
Assignment.search("tag:assignment").filter(a => a.related.solvedin.release == 'R12')
```

Using .relations (or .rels), you get an object with relations in arrays (doesn't assume only one).

Note that by stepping through relations, the type is Entity and not any custom (as it would be impossible to infer it). You can however always get a typed version by calling .from like this: `MyType.from(entity)`.

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
 - `rel(e2, rel, replace)`: Create a relation to e2 (Entity) with type rel (string). Set `replace` to true to replace existing relation. If `replace` is true and a non-entity (eg. null or undefined) is passed as `e2`, the existing relation is removed.
 - `tag(tag)`: Add tag "tag" to entity. Can be an array. null and undefined are ignored.
 - `prop(name, value)`: Set property "name" to "value".
 - `removeRel(e2, rel)`: Remove relation to e2 (Entity) of type rel (string)
 - `removeTag(tag)`: Remove tag "tag".
 - `removeProp(name)`: Remove property "name".
 - `removeBlob()`: Remove blob.
 - `openBlob()`: get at writable stream to the blob
 - `delete()`: delete all information about the entity
 - `setBlob(data)`: set blob. Can be either a stream, a buffer or a string.
 - `rels`: get all relations (object like `{"rel1": [e1, e2], "rel2": [e1]}`)
 - `relsrev`: get all relations in the other direction
 - `props`: get all properties as an object (also accessible using .propertyname directly on entity)
 - `tags`: get all tags (array)
 - `blob`: get blob (stream)

Entity static methods:
 - `find(filter)`: Search for filter "filter" and return first result
 - `findOrCreate(filter)`: same as find, but returns a new Entity if none is found
 - `search(filter, args)`: Search for filter and return all results as an array
 - `from(entity)`: Cast a generic Entity to any custom type. Eg.: `MyType.from(entity)`.
 - `init(dataPath)`: Initialize Entity and load data. Remember to use await, as it is async.

Extra imports:
 - `nextNum(context)`: Get next number in a number sequence
 - `setNum(context, num)`: Set next number in a number sequence (cannot set lower id than what has been used before)
 - `lastNum(context)`: Get last number in a number sequence
 - `sanitize(inputText)`: Sanitize text for using in a query (eg. from user input)

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

Blobs can be opened by calling `openBlob()` on the entity. This returns a Writable stream.

If you need stats on the file, it can be retrived like this:
```javascript
let stats = await e.blob.stats()
console.log(stats) // Returns the same object as node's own fs.stat
```

If you want to find entities with/without a blob, you can use "blob" and "!blob".

## User Interface

There is a very minimalist user interface embedded. It can be used in an existing express (or similar) environment like the following. In this case you can then use the user interface on ''.../db''.

```javascript
let {uiPath, uiAPI} = await Entity.init("./data");
app.use("/db", express.static(uiPath))
app.use("/db/api/:query", uiAPI)
```

*Please make sure to disable it in production or at least secure it!*

Enter query and hit enter to search. Please notice that you can click on tags, properties and relation id's to navigate to a search for them.

To combine it with MSCP, use the following:
```javascript
let {uiPath, uiAPI} = await Entity.init("./data");
mscp.use("/db/api/:query", uiAPI)
mscp.static("/db", uiPath)
```

## History

EntityStorage can provide a full history/changelog of Entity changes. It is enabled on an entity-by-entity basis by calling `myEntity.enableHistory()`. After doing that, the history is available by calling `myEntity.history`.

If you want, you can add custom entries using `myEntity.addHistoryEntry(data, timestamp)`. Timestamp is optional and data can be any javascript object/array/value. Custom entries will have `type: "custom"` when extracted.

History can be cleared by calling `myEntity.clearHistory()`.

When searching, you can find entities which was created and/or updated in a period.

Examples:
 - `created:>2021-10`: Created in october 2021 or after
 - `created:2021-10`: Created in october 2021
 - `updated:<2021`: Updated in 2021 or before

## Number Sequences

Import `nextNum` for a persistant number sequence handler. It takes one (optional) argument, which is a context. The numbers are tied to the context. It can be used to generate sequential, user-facing id's for your entities.

Example:

```javascript
import {default as Entity, nextNum} from "entitystorage"
...
console.log(nextNum("test1")) // Prints 1
console.log(nextNum("test2")) // Prints 1
console.log(nextNum("test1")) // Prints 2
console.log(nextNum("test1")) // Prints 3
console.log(nextNum("test2")) // Prints 2
```

## Alternative searching: query

As an alternative to filter based query, it is possible to use the export `query` instead. Examples: 

```javascript
// Get all results with property test=hey2:
query.tag("testsearch").prop("test", "hey2").all

// Casting the first result to type/class My and calling class method log() on it:
query.tag("testsearch").prop("test", "hey2").type(My).first.log()

// Get all results with tag testsearch or testsearch3:
query.tag("testsearch").or(query.tag("testsearch3")).all

// Get all results with property test3 defined:
query.prop("test3").all

// Get all results with tag testsearch, but not property test=hey2:
query.tag("testsearch").not(query.prop("test", "hey2")).all 

// Get entity with id=4
query.id(4).first
```

Important: Unlike find/search, the order of the entities are NOT guaranteed using `query`. This is for performance reasons, as `query` is much faster.

API:
 - `prop(prop, value)`: filter by prop and value. Value is optional. If Value is omitted, it will search for entities with that property defined.
 - `tag(tag)`: filter by tag
 - `id(id)`:  filter by id
 - `and(query2)`: results must match the current query and `query2`
 - `or(query2)`: results must match the current query or `query2`
 - `not(query2)`: results must match the current query and NOT `query2`
 - `first`: get first result. Note that the order is not guaranteed, so you might end up with a different result if you run it twice.
 - `all`: get all results as an array. Note that the order is not guaranteed, so you might end up with a different result if you run it twice.
 - `ids`: get all results as a Set of id integers (not instances of Entity). Is faster, if you only want to check for number of items.
 - `exists`: a boolean indicating if there is any results
 - `count`: number of results