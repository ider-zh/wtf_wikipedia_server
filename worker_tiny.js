const wtf = require('wtf_wikipedia')
var _ = require("lodash")

const linksTypeGroup = (item) => {
    return item.type
}

function extract_wiki_text(wikiText) {
    let doc = wtf(wikiText)
    let data = doc.json({ images: false, sections: false, coordinates: false, infoboxes: false, categories: true, plaintext: false })
    let linkGroup = _.chain(doc.links()).map(item => item.data).uniqBy("raw").groupBy(linksTypeGroup).mapValues(items => {
        return items.map(item => {
            delete (item.type)
            delete (item.raw)
            return item
        })
    }).value()
    if (Object.keys(linkGroup).length > 0) {
        data.links = linkGroup
    }

    for (let key of ['links', 'categories']) {
        if (data[key] && data[key].length === 0)
            delete data[key]
    }

    return data
}

module.exports = extract_wiki_text
