const fs = require('node:fs')
const vm = require('node:vm')
const {extractGraph} = require('../../src/graph')
// Independent oracle: pinned official browser AST, never the Node crash recorder.
const context = vm.createContext({})
vm.runInContext(fs.readFileSync(require.resolve('wikiparser-node/bundle/bundle-es10.min.js'), 'utf8'), context)
context.Parser.config.ext.push('nowiki','pre','source','syntaxhighlight','templatedata')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'9007199254740993',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
const suffix = ' [[Visible]] [[Category:VisibleCategory]]'
test.each([
 '<nowiki><pre></nowiki>',
 '<nowiki><nowiki>literal</nowiki>',
 '<syntaxhighlight><nowiki></syntaxhighlight>',
 '<nowiki><pre/>literal</nowiki>',
 '<nowiki><pre title="</nowiki>',
 '<div><nowiki></div>literal</nowiki>'
])('literal contents do not nest: %s', literal => {
 const text = literal + suffix
 const ast = context.Parser.parse(text)
 expect(Array.from(ast.querySelectorAll('link'), node => String(node.firstChild))).toEqual(['Visible'])
 expect(Array.from(ast.querySelectorAll('category'), node => String(node.firstChild))).toEqual(['Category:VisibleCategory'])
 expect(extractGraph({...base,text})).toEqual({...base,links:[{target:'Visible'}],categories:['VisibleCategory'],redirect_target:null,parse_status:'ok'})
})
test.each([
 '<nowiki>literal</NOWIKI>',
 '<NoWiki>literal</nowiki>',
 '<SYNTAXHIGHLIGHT>literal</syntaxhighlight>'
])('mixed-case literal closes preserve AST-visible adjacency: %s', literal => {
 const text = literal + suffix
 const ast = context.Parser.parse(text)
 expect(Array.from(ast.querySelectorAll('link'), node => String(node.firstChild))).toEqual(['Visible'])
 expect(Array.from(ast.querySelectorAll('category'), node => String(node.firstChild))).toEqual(['Category:VisibleCategory'])
 expect(extractGraph({...base,text})).toEqual({...base,links:[{target:'Visible'}],categories:['VisibleCategory'],redirect_target:null,parse_status:'ok'})
})
