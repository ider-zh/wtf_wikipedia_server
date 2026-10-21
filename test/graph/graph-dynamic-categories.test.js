const fs = require('node:fs')
const path = require('node:path')
const {randomUUID} = require('node:crypto')
const {spawnSync} = require('node:child_process')
const {extractGraph} = require('../../src/graph')
const {dynamicCategoryTargets} = require('../../src/graph/ast')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
const cli = path.resolve(__dirname,'../../bin/graph.js')

test('AST-proven dynamic category membership makes the record partial without an invented edge', () => {
 const diagnostics = {}
 expect(extractGraph({...base,text:'[[Category:{{x}}]]'}, {diagnostics})).toEqual({
  ...base,links:[],categories:[],redirect_target:null,parse_status:'partial_unresolved_target'
 })
 expect(diagnostics.unresolved_dynamic_targets).toBe(1)
})

test('category matching permits namespace casing and title spacing without guessing expressions', () => {
 expect(extractGraph({...base,text:'[[cAtEgOrY : Prefix_{{x}}_Tail ]]'})).toMatchObject({
  categories:[],parse_status:'partial_unresolved_target'
 })
})

test.each([
 '[[Category:Bad{{caption}}]]',
 '[[Category:Prefix{{x}}Suffix]]',
 '[[Category:{{{arg}}}]]',
 '[[Category:{{outer{{inner}}}}]]',
 '[[Category:{{outer{{{arg}}}}}]]',
 '[[分类:{{x}}]]',
 '[[分類:Prefix_{{{arg}}}_Suffix]]',
 '[[CATEGORY : Prefix_{{x}}_Suffix ]]'
])('dynamic target AST variants retain the explicit partial contract: case %#', text => {
 const diagnostics = {}
 const out = extractGraph({...base,text:`[[Confirmed]] ${text} [[Category:Static]]`}, {diagnostics})
 expect(out).toEqual({...base,links:[{target:'Confirmed'}],categories:['Static'],redirect_target:null,parse_status:'partial_unresolved_target'})
 expect(diagnostics.unresolved_dynamic_targets).toBe(1)
})

test('mixed memberships preserve every confirmed static category and escaped category link', () => {
 const diagnostics = {unresolved_dynamic_targets:7}
 const text = '[[Category:{{x}}]] [[Category:{{x}}]] [[分类:{{{arg}}}]] ' +
  '[[Category:A]] [[Category:A]] [[分类:A]] [[分类:Other_Name]] [[分類:Other_Name]] [[分類:lower]] [[Category:Lower]] ' +
  '[[Category:With_sort|{{x}}]] [[:Category:Escaped]] [[:分类:Escaped_Chinese]] [[Safe|{{label}}]]'
 const out = extractGraph({...base,text}, {diagnostics})
 expect(out).toEqual({...base,links:[{target:'Category:Escaped',namespace:14},{target:'Safe'},{target:'分类:Escaped Chinese',namespace:14}],
  categories:['A','Lower','Other Name','With sort','lower'],redirect_target:null,parse_status:'partial_unresolved_target'})
 expect(diagnostics).toEqual({unresolved_dynamic_targets:10})
})

test('dynamic category membership preserves the primary parser redirect observation', () => {
 expect(extractGraph({...base,text:'#REDIRECT [[Destination]]\n[[Category:{{x}}]] [[Category:Member]]'})).toEqual({
  ...base,links:[],categories:['Member'],redirect_target:'Destination',parse_status:'partial_unresolved_target'
 })
 expect(() => extractGraph({...base,text:'#REDIRECT [[Bad{{x}}]]\n[[Category:{{x}}]]'})).toThrow('PARSE_ERROR')
})

test('ordinary and caption reconciliation counts add category occurrences without double counting links', () => {
 const diagnostics = {}
 const text = '[[Bad[Caption]] [[{{x}}]] [[File:A.jpg|thumb|[[{{y}}]] [[Caption]]]] [[Static]] [[Category:Member]] [[Category:{{z}}]]'
 expect(extractGraph({...base,text}, {diagnostics})).toMatchObject({links:[{target:'Caption'},{target:'Static'}],categories:['Member'],parse_status:'partial_unresolved_target'})
 expect(diagnostics).toEqual({ast_reconciliations:1,parser_nonlinks:1,unresolved_dynamic_targets:3})
})

test.each([
 '[[Category:Static|{{x}}]]',
 '[[Category:Static|{{{arg}}}]]',
 '<!-- [[Category:{{x}}]] --> [[Category:Static]]',
 '<nowiki>[[Category:{{x}}]]</nowiki> [[Category:Static]]',
 '<pre>[[Category:{{x}}]]</pre> [[Category:Static]]',
 '<source>[[Category:{{x}}]]</source> [[Category:Static]]',
 '<syntaxhighlight>[[Category:{{x}}]]</syntaxhighlight> [[Category:Static]]',
 '<templatedata>[[Category:{{x}}]]</templatedata> [[Category:Static]]'
])('sortkeys and opaque regions are not dynamic membership targets: case %#', text => {
 const diagnostics = {}
 expect(extractGraph({...base,text}, {diagnostics})).toMatchObject({categories:['Static'],parse_status:'ok'})
 expect(diagnostics).toEqual({})
})

test('AST classifier uses membership target nodes, not escaped links, sortkeys or arbitrary non-text nodes', () => {
 expect([...dynamicCategoryTargets('[[:Category:{{x}}]] [[Category:Static|{{x}}]] [[Category:A<!--comment-->B]]')]).toEqual([])
 // Dynamic expressions are matched exactly, not title-normalized internally.
 expect([...dynamicCategoryTargets('[[分类:Prefix_{{x_y}} ]]')]).toEqual(['Prefix_{{x_y}}'])
})

test.each([
 '[[Category:Bad{x}]]',
 '[[Category:Bad\u0001Name]]',
 '[[Category:Static#Bad{Name}]]',
 '[[Category:{{y|nested}}]]',
 '[[Category:{{{arg|default}}}]]',
 '[[Category:{{outer|{{inner}}}}]]',
 '[[Category:{{x}]]',
 '[[Bad[Caption]] [[A\u0001B]]',
 '{{percentage|1|2|decimals=101}}'
])('a proven dynamic category never excuses another unsafe or unmatched target: case %#', unsafe => {
 expect(() => extractGraph({...base,text:`[[Confirmed]] [[Category:{{x}}]] ${unsafe}`})).toThrow('PARSE_ERROR')
 expect(() => extractGraph({...base,text:`${unsafe} [[Confirmed]] [[Category:{{x}}]]`})).toThrow('PARSE_ERROR')
})

test('unexpanded pipe-containing category candidates stay fatal unless their full AST target matches', () => {
 // WTF truncates at the template argument pipe. Never guess, strip braces or
 // match prefixes to excuse this unsafe candidate, even beside an exact match.
 expect(() => extractGraph({...base,text:'[[Category:{{x|a|b}}]]'})).toThrow('PARSE_ERROR')
})

test('safe membership pages do not invoke the on-demand category AST reconciliation', () => {
 jest.isolateModules(() => {
  const helpers = require('../../src/graph/ast')
  const spy = jest.spyOn(helpers,'dynamicCategoryTargets')
  const isolated = require('../../src/graph').extractGraph
  try {
   isolated({...base,text:'[[Static]] [[Category:A]] [[Category:Static|{{x}}]]'})
   expect(spy).not.toHaveBeenCalled()
   isolated({...base,text:'[[Category:{{x}}]] [[分类:{{y}}]]'})
   expect(spy).toHaveBeenCalledTimes(1)
  } finally {spy.mockRestore()}
 })
})

test('category partial results do not expose canaries, log, write files or load a crash recorder', () => {
 const canary = randomUUID()
 const consoles = ['log','warn','error','info','debug','trace'].map(k => jest.spyOn(console,k))
 const writes = ['writeFileSync','appendFileSync','writeFile','appendFile'].map(k => jest.spyOn(fs,k))
 try {
  const diagnostics = {}
  const out = extractGraph({...base,text:`BODY_${canary} [[Confirmed]] [[Category:{{${canary}}}]] [[Category:Member]]`}, {diagnostics})
  expect(out).toEqual({...base,links:[{target:'Confirmed'}],categories:['Member'],redirect_target:null,parse_status:'partial_unresolved_target'})
  expect(JSON.stringify({out,diagnostics})).not.toContain(canary)
  expect(Object.values(diagnostics).every(Number.isSafeInteger)).toBe(true)
  for (const spy of [...consoles,...writes]) expect(spy).not.toHaveBeenCalled()
  expect(Object.keys(require.cache).some(p => p.endsWith('/crash-case.js') || p.endsWith('/wikiparser-node/dist/index.js'))).toBe(false)
 } finally {for (const spy of [...consoles,...writes]) spy.mockRestore()}
})

test('real CLI emits prefix, partial membership record and suffix with unchanged output keys and no files', () => {
 const canary = randomUUID()
 const dir = fs.mkdtempSync(path.join(process.env.TMPDIR,'graph-category-partial-'))
 const records = [
  {...base,text:'[[Previous]]'},
  {...base,text:`BODY_${canary} [[Confirmed]] [[Category:{{${canary}}}]] [[Category:Member]]`},
  {...base,text:'[[Following]]'}
 ]
 try {
  const result = spawnSync(process.execPath,[cli],{input:records.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',cwd:dir})
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  const out = result.stdout.trim().split('\n').map(JSON.parse)
  expect(out).toEqual([
   {...base,links:[{target:'Previous'}],categories:[],redirect_target:null,parse_status:'ok'},
   {...base,links:[{target:'Confirmed'}],categories:['Member'],redirect_target:null,parse_status:'partial_unresolved_target'},
   {...base,links:[{target:'Following'}],categories:[],redirect_target:null,parse_status:'ok'}
  ])
  expect(result.stdout+result.stderr).not.toContain(canary)
  expect(fs.readdirSync(dir)).toEqual([])
 } finally {fs.rmSync(dir,{recursive:true})}
})

test('real CLI rejects a static unsafe membership after a valid partial prefix and does not emit the suffix', () => {
 const canary = randomUUID()
 const dir = fs.mkdtempSync(path.join(process.env.TMPDIR,'graph-category-fatal-'))
 const prefix = [{...base,text:'[[Previous]]'},{...base,text:`BODY_${canary} [[Category:{{${canary}}}]] [[Category:Member]]`}]
 const bad = {...base,text:`BODY_${canary} [[SafeCurrent]] [[Category:{{${canary}}}]] [[Category:Static{Unsafe}]]`}
 try {
  const result = spawnSync(process.execPath,[cli],{input:[...prefix,bad,{...base,text:'[[Following]]'}].map(JSON.stringify).join('\n')+'\n',encoding:'utf8',cwd:dir})
  expect(result.status).toBe(1)
  expect(result.stdout).toBe(prefix.map(record => JSON.stringify(extractGraph(record))).join('\n')+'\n')
  expect(result.stderr).toBe('{"code":"PARSE_ERROR","request_id":3}\n')
  expect(result.stdout+result.stderr).not.toContain(canary)
  expect(result.stdout).not.toContain('SafeCurrent')
  expect(result.stdout).not.toContain('Following')
  expect(fs.readdirSync(dir)).toEqual([])
 } finally {fs.rmSync(dir,{recursive:true})}
})
