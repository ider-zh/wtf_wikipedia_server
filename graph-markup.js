'use strict'
const {Parser} = require('htmlparser2')
const literalTags = new Set(['nowiki','pre','source','syntaxhighlight','templatedata'])

// Library token offsets, not a body-stripping regexp. XML mode avoids HTML's
// implied paragraph closures and honors self-closing extension tags. No AST or
// body escapes this synchronous call; only the transient sanitized text returns.
function maskLiteralMarkup(text) {
  const ranges = [], stack = []
  let parser
  parser = new Parser({
    onopentag(name) {
      name = name.toLowerCase()
      if (!literalTags.has(name)) return
      const start = parser.startIndex, end = parser.endIndex + 1
      if (text[end - 2] === '/') {
        if (!stack.length) ranges.push([start,end])
      } else stack.push({name,start})
    },
    onclosetag(name, implied) {
      if (implied || !stack.length || stack[stack.length - 1].name !== name.toLowerCase()) return
      const opened = stack.pop()
      if (!stack.length) ranges.push([opened.start,parser.endIndex + 1])
    },
    oncomment() {
      if (!stack.length) ranges.push([parser.startIndex,parser.endIndex + 1])
    }
  }, {xmlMode:true,decodeEntities:false})
  parser.end(text)
  if (stack.length) ranges.push([stack[0].start,text.length])
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
