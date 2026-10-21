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
  return Array.from(parser.parse(wikitext).querySelectorAll('link'), link => String(link.firstChild))
}
function ordinaryLinkTargets(wikitext, candidates = []) {
  // Only real AST link nodes are edges. Malformed bracket text is not a link;
  // nested valid links are independently represented by the upstream parser.
  const nodes = Array.from(parser.parse(wikitext).querySelectorAll('link'))
  const sources = new Set(nodes.map(String))
  return {targets:nodes.map(link => String(link.firstChild)),
    nonlinks:candidates.filter(source => !sources.has(source)).length}
}
module.exports = {imageCaptionTargets, ordinaryLinkTargets}
