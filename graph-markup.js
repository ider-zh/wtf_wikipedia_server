'use strict'
const {Tokenizer} = require('htmlparser2')
const {literalMarkupRanges} = require('./graph-images')
const literalTags = new Set(['nowiki','pre','source','syntaxhighlight','templatedata'])
const noop = () => {}

// Consume real tokenizer offsets, not XML tree matching: MediaWiki literal
// regions are opaque and non-nesting, with case-insensitive closing names.
// No AST or body escapes this synchronous call.
function maskLiteralMarkup(text) {
  const ranges = []
  let opened = null, pending = null
  const tokenizer = new Tokenizer({xmlMode:true,decodeEntities:false}, {
    onopentagname(start,end) {
      const name = text.slice(start,end).toLowerCase()
      pending = !opened && literalTags.has(name) ? {name,start:start - 1} : null
    },
    onopentagend() {
      if (pending) opened = pending
      pending = null
    },
    onselfclosingtag(end) {
      if (pending) ranges.push([pending.start,end + 1])
      pending = null
    },
    onclosetag(start,end) {
      if (!opened || text.slice(start,end).toLowerCase() !== opened.name) return
      // The tokenizer emits the closing name before consuming its trailing >.
      const close = text.indexOf('>',end)
      ranges.push([opened.start,close < 0 ? text.length : close + 1])
      opened = null
    },
    oncomment(start,end) {
      if (!opened) ranges.push([start - 4,Math.min(end + 1,text.length)])
    },
    onattribdata:noop, onattribentity:noop, onattribend:noop,
    onattribname:noop, oncdata:noop, ondeclaration:noop, onend:noop,
    onprocessinginstruction:noop, ontext:noop, ontextentity:noop
  })
  tokenizer.write(text)
  tokenizer.end()
  if (opened) ranges.push([opened.start,text.length])
  // Raw HTML lexing can swallow a close inside tag-looking quoted literal
  // contents. Real extension AST offsets own every recognized literal range;
  // retain tokenizer ranges only outside them (including unclosed EOF policy).
  if (ranges.some(([start]) => text[start + 1] !== '!')) {
    const astRanges = literalMarkupRanges(text)
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (astRanges.some(([start,end]) => ranges[i][0] >= start && ranges[i][0] < end)) ranges.splice(i,1)
    }
    ranges.push(...astRanges)
  }
  ranges.sort((a,b) => a[0]-b[0])
  const pieces = []
  let cursor = 0
  for (const [start,end] of ranges) {
    if (end <= cursor) continue
    pieces.push(text.slice(cursor,Math.max(cursor,start)), ' ')
    cursor = end
  }
  pieces.push(text.slice(cursor))
  return pieces.join('')
}
module.exports = {maskLiteralMarkup}
