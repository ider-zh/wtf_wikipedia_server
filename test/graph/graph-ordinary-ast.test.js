const {extractGraph} = require('../../src/graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}

test('malformed ordinary bracket markup is an AST nonlink, not a record failure or invented edge', () => {
 const diagnostics = {}
 const out = extractGraph({...base,text:'[[Before]] [[Bad[Caption]] [[After]]'}, {diagnostics})
 expect(out.links).toEqual([{target:'After'},{target:'Before'}])
 expect(out.parse_status).toBe('ok')
 expect(diagnostics).toEqual({ast_reconciliations:1,parser_nonlinks:1})
})

test('AST recovers the semantic target of a valid multi-pipe label', () => {
 expect(extractGraph({...base,text:'[[Destination|label|tail]] [[Other]]'}).links).toEqual([{target:'Destination'},{target:'Other'}])
})

test('whole-page AST reconciliation keeps nested valid links, caption links, aliases and category membership', () => {
 const out = extractGraph({...base,text:'[[Bad[Caption]] [[Outer [[Inner]] tail]] [[檔案:Example.jpg|thumb|[[Caption]]]] [[:分類:Escaped]] [[分類:Member]]'})
 expect(out.links).toEqual([{target:'Caption'},{target:'Inner'},{target:'分類:Escaped',namespace:14}])
 expect(out.categories).toEqual(['Member'])
})

test('AST unresolved target is partial while confirmed static graph observations survive', () => {
 const diagnostics = {}
 const out = extractGraph({...base,text:'[[Bad[Caption]] [[Unresolved{{name}}]] [[Before]] [[Category:Member]]'}, {diagnostics})
 expect(out.links).toEqual([{target:'Before'}])
 expect(out.categories).toEqual(['Member'])
 expect(out.redirect_target).toBe(null)
 expect(out.parse_status).toBe('partial_unresolved_target')
 expect(diagnostics).toEqual({ast_reconciliations:1,parser_nonlinks:1,unresolved_dynamic_targets:1})
 expect(Object.keys(out).sort()).toEqual(['page_id','ns','title','revision_id','timestamp','text_state','links','categories','redirect_target','parse_status'].sort())
})
