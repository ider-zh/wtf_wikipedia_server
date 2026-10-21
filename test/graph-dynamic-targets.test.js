const {ordinaryLinkTargets, imageCaptionTargets} = require('../graph-images')
const {extractGraph} = require('../graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}

test('caption AST classifies dynamic targets without treating display templates as targets', () => {
 const parsed = imageCaptionTargets('[[File:A.jpg|thumb|[[{{x}}]] [[Prefix{{x}}]] [[{{{arg}}}]] [[Safe|{{label}}]]]]')
 expect(parsed.targets).toEqual(['Safe'])
 expect(parsed.unresolved).toBe(3)
})

test.each(['[[{{x}}]]','[[Prefix{{x}}]]','[[{{{arg}}}]]','[[{{x|a|b}}]]'])(
 'ordinary AST recognizes dynamic-only target %s without inventing an edge', text => {
  expect(ordinaryLinkTargets(text)).toEqual({targets:[],unresolved:1,nonlinks:0})
 })

test.each(['[[[[{{x}}]]','[[A[B]][[{{x}}]]','[[A[B]][[{{x|a|b}}]]','[[A[B]][[Prefix{{x}}]]','[[A[B]][[{{{arg}}}]]'])(
 'minimal interaction keeps the record explicitly partial: %s', text => {
  const diagnostics = {}
  expect(extractGraph({...base,text}, {diagnostics})).toMatchObject({links:[],categories:[],redirect_target:null,parse_status:'partial_unresolved_target'})
  expect(diagnostics.unresolved_dynamic_targets).toBe(1)
 })

test('counts dynamic target occurrences, not template nodes or deduplicated strings', () => {
 const diagnostics = {unresolved_dynamic_targets:7,ast_reconciliations:2,parser_nonlinks:4}
 const text = '[[Bad[Caption]] [[{{x}}{{y}}]] [[{{x}}{{y}}]] [[Safe|{{label}}]]'
 const out = extractGraph({...base,text}, {diagnostics})
 expect(out.links).toEqual([{target:'Safe'}])
 expect(out.parse_status).toBe('partial_unresolved_target')
 expect(diagnostics).toEqual({unresolved_dynamic_targets:9,ast_reconciliations:3,parser_nonlinks:5})
})

test('whole-page AST counts ordinary and caption dynamic targets once and preserves static captions', () => {
 const diagnostics = {}
 const out = extractGraph({...base,text:'[[Bad[Caption]] [[{{x}}]] [[File:A.jpg|thumb|[[{{y}}]] [[Caption]]]] [[Static]] [[Category:Member]]'}, {diagnostics})
 expect(out).toMatchObject({links:[{target:'Caption'},{target:'Static'}],categories:['Member'],parse_status:'partial_unresolved_target'})
 expect(diagnostics).toEqual({ast_reconciliations:1,parser_nonlinks:1,unresolved_dynamic_targets:2})
})

test('a non-text target child is not enough to classify it as dynamic', () => {
 expect(ordinaryLinkTargets('[[A<!--comment-->B]]')).toEqual({targets:['A<!--comment-->B'],unresolved:0,nonlinks:0})
})

test('static unsafe actual AST targets still fail even beside recognized dynamic targets', () => {
 expect(ordinaryLinkTargets('[[A\u0001B]]')).toEqual({targets:['A\u0001B'],unresolved:0,nonlinks:0})
 expect(() => extractGraph({...base,text:'[[Bad[Caption]] [[{{x}}]] [[A\u0001B]]'})).toThrow('PARSE_ERROR')
})

test('static display-template labels remain ordinary links with no partial status', () => {
 const diagnostics = {}
 const out = extractGraph({...base,text:'[[Bad[Caption]] [[Safe|{{label}}]]'}, {diagnostics})
 expect(out).toMatchObject({links:[{target:'Safe'}],parse_status:'ok'})
 expect(diagnostics).toEqual({ast_reconciliations:1,parser_nonlinks:1})
})

test('the primary-only path is not upgraded to a whole-page AST or a completeness claim', () => {
 const diagnostics = {}
 expect(extractGraph({...base,text:'[[{{x}}]] [[Static]]'}, {diagnostics})).toMatchObject({links:[{target:'Static'}],parse_status:'ok'})
 expect(diagnostics).toEqual({})
})

test('redirect observation remains unchanged on the primary path', () => {
 expect(extractGraph({...base,text:'#REDIRECT [[Destination]]'})).toMatchObject({redirect_target:'Destination',parse_status:'ok'})
})
