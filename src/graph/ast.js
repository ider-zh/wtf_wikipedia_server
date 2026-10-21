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
function hasDynamicTarget(target) {
  // Target subtree only: display labels and category sortkeys are not targets.
  const pending = Array.from(target.childNodes)
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'template' || node.type === 'arg') return true
    if (node.childNodes) for (const child of node.childNodes) pending.push(child)
  }
  return false
}
function dynamicCategoryTargets(wikitext) {
  return new Set(Array.from(parser.parse(wikitext).querySelectorAll('category'))
    .filter(category => hasDynamicTarget(category.firstChild))
    // Strip only the membership namespace and outer title whitespace. Keep
    // expression spelling/case/underscores intact for exact reconciliation.
    .map(category => String(category.firstChild).replace(/^(?:Category|分类|分類)\s*:/iu, '').trim()))
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
    if (hasDynamicTarget(link.firstChild)) unresolved++
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
module.exports = {imageCaptionTargets, ordinaryLinkTargets, dynamicCategoryTargets, literalMarkupRanges}
