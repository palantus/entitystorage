$(() => {
    let defaultQuery = new URL(window.location.href).searchParams.get("query");
    let showReverse = new URL(window.location.href).searchParams.get("reverse") == "true";
    $("#showreverse").prop("checked", showReverse).on("click", gotoSearch)

    if(defaultQuery){
        $("#query").val(defaultQuery)
        doSearch(defaultQuery, showReverse)
    }

    $("#query").focus().select().keypress(function(e) {
        if(e.which == 13) {
            gotoSearch();
            //doSearch($("#query").val())
        }
      });
})

async function gotoSearch(){
  window.location = `?query=${$("#query").val()}&reverse=${$("#showreverse").is(":checked")?"true":"false"}`
}

async function doSearch(query, showReverse){
    let res = await fetch("api/" + query + "?includeReverse=" + (showReverse?"true":"false"))
    let entities = await res.json()
    let tab = $("#result tbody").empty()
    let message = $("#message").hide();

    if(entities.length < 1){
        message.show().html("No results")
        return;
    }

    $("#result thead tr th:last-child").css("display", showReverse ? "block" : "none")

    for(let e of entities){
        let row = $("<tr/>")

        row.append(`<td>${e.id}</td>`)
        row.append(`<td>${Object.keys(e.props).map(p => typeof e.props[p] === "object" ? `${p} = ${JSON.stringify(e.props[p])}` : `<a href="?query=prop:%22${p}=${e.props[p]}%22">${p} = ${e.props[p]}</a>`).join("<br/>")}</td>`)
        row.append(`<td>${e.tags.map(t => `<a href="?query=tag:%22${t}%22">${t}</a>`).join(", ")}</td>`)
        row.append(`<td>${Object.keys(e.rels).map(r => `${r}: ${e.rels[r].map(ri => `<a href="?query=id:${ri._id}">${ri._id}</a>`).join(", ")}`).join("<br/>")}</td>`)
        if(showReverse)
          row.append(`<td>${Object.keys(e.relsrev).map(r => `${r}: ${e.relsrev[r].map(ri => `<a href="?query=id:${ri._id}">${ri._id}</a>`).join(", ")}`).join("<br/>")}</td>`)

        tab.append(row)
    }

    tab.parent().show();
}