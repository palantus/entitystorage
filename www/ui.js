$(() => {
    let defaultQuery = new URL(window.location.href).searchParams.get("query");

    if(defaultQuery){
        $("#query").val(defaultQuery)
        doSearch($("#query").val())
    }

    $("#query").focus().select().keypress(function(e) {
        if(e.which == 13) {
            doSearch($("#query").val())
        }
      });
})

async function doSearch(query){
    let res = await fetch("api/" + query)
    let entities = await res.json()
    let tab = $("#result tbody").empty()
    let message = $("#message").hide();

    if(entities.length < 1){
        message.show().html("No results")
        return;
    }

    for(let e of entities){
        let row = $("<tr/>")

        row.append(`<td>${e.id}</td>`)
        row.append(`<td>${Object.keys(e.props).map(p => `<a href="?query=prop:${p}=%22${e.props[p]}%22">${p} = ${e.props[p]}</a>`).join("<br/>")}</td>`)
        row.append(`<td>${e.tags.map(t => `<a href="?query=tag:%22${t}%22">${t}</a>`).join(", ")}</td>`)
        row.append(`<td>${Object.keys(e.rels).map(r => `${r}: ${e.rels[r].map(ri => `<a href="?query=id:${ri._id}">${ri._id}</a>`).join(", ")}`).join("<br/>")}</td>`)

        tab.append(row)
    }

    tab.parent().show();
}