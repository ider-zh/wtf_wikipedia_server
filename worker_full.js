const wtf = require('wtf_wikipedia')
var _ = require("lodash")

const linksTypeGroup = (item) => {
    return item.type
}

function extract_wiki_text(wikiText) {
    let doc = wtf(wikiText)
    let data = doc.json({ images: true, sections: false, coordinates: true, infoboxes: true, categories: true, plaintext: true })
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

    for (let key of ['coordinates', 'infoboxes', 'images', 'links', 'categories']) {
        if (data[key] && data[key].length === 0)
            delete data[key]
    }

    // unknow the links usage, it always empty
    if (data['images']?.length > 0) {
        data['images'] = data['images'].map(item => {
            delete item['links']
            return item
        })

    }

    return data
}

module.exports = extract_wiki_text
