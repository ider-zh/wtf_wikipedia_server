'use strict'
const fs = require('node:fs')
const vm = require('node:vm')
// The Node entry point writes raw wikitext on parser exceptions. The official
// browser build excludes that recorder. Give it no process, require, filesystem,
// network or console capabilities. Only static installed library code is read.
const context = vm.createContext({})
vm.runInContext(fs.readFileSync(require.resolve('wikiparser-node/bundle/bundle-es10.min.js'),'utf8'),context)
const parser = context.Parser
// Match the graph adapter's localized namespaces without rewriting AST source.
Object.assign(parser.config.nsid, {'分类':14,'分類':14,'文件':6,'檔案':6})
function imageCaptionTargets(wikitext) {
  return ordinaryLinkTargets(wikitext)
}
function ordinaryLinkTargets(wikitext, candidates = []) {
  // Only real AST link nodes are edges. Malformed bracket text is not a link;
  // nested valid links are independently represented by the upstream parser.
  const nodes = Array.from(parser.parse(wikitext).querySelectorAll('link'))
  const sources = new Set(nodes.map(String))
  const targets = []
  let unresolved = 0
  for (const link of nodes) {
    // Inspect only this target's AST subtree, never the display label. The
    // installed parser represents unexpanded templates and arguments by these
    // explicit node types; other non-text nodes are not automatically dynamic.
    const pending = Array.from(link.firstChild.childNodes)
    let dynamic = false
    while (pending.length) {
      const node = pending.pop()
      if (node.type === 'template' || node.type === 'arg') { dynamic = true; break }
      if (node.childNodes) for (const child of node.childNodes) pending.push(child)
    }
    if (dynamic) unresolved++
    else targets.push(String(link.firstChild))
  }
  return {targets, unresolved,
    nonlinks:candidates.filter(source => !sources.has(source)).length}
}
const literalTags = ['nowiki','pre','source','syntaxhighlight','templatedata']
const literalConfig = {...parser.getConfig(),ext:literalTags}
function literalMarkupRanges(wikitext) {
  // Stage one is the official extension/comment AST, without link parsing.
  return Array.from(parser.parse(wikitext,false,1,literalConfig).querySelectorAll('ext'), node => {
    const start = node.getAbsoluteIndex()
    return [start,start + String(node).length]
  })
}
module.exports = {imageCaptionTargets, ordinaryLinkTargets, literalMarkupRanges}
