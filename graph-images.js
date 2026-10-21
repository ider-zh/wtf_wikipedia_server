'use strict'
const fs = require('node:fs')
const vm = require('node:vm')
// The Node entry point writes raw wikitext on parser exceptions. The official
// browser build excludes that recorder. Give it no process, require, filesystem,
// network or console capabilities. Only static installed library code is read.
const context = vm.createContext({})
vm.runInContext(fs.readFileSync(require.resolve('wikiparser-node/bundle/bundle-es10.min.js'),'utf8'),context)
const parser = context.Parser
function imageCaptionTargets(wikitext) {
  return Array.from(parser.parse(wikitext).querySelectorAll('link'), link => String(link.firstChild))
}
module.exports = {imageCaptionTargets}
