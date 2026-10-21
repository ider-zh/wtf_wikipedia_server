const {spawnSync} = require('node:child_process')
const {randomUUID} = require('node:crypto')
const path = require('node:path')
const {extractGraph} = require('../graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'9007199254740993',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
const literal = '{"description":"[[LiteralTarget]] [[Category:LiteralCategory]]","params":{}}'
const cases = ['nowiki','pre','source','syntaxhighlight','templatedata'].flatMap(tag => [
 [`${tag}: paired`, `<${tag}>${literal}</${tag}> [[Visible]]`],
 [`${tag}: benign`, `<${tag}>benign contents</${tag}> [[Visible]]`],
 [`${tag}: nested markup`, `<${tag}><b>${literal}</b><nowiki>${literal}</nowiki></${tag}> [[Visible]]`],
 [`${tag}: mixed case and long quoted attributes`, `<${tag.toUpperCase()} data-test="${'x'.repeat(250)} > [[AttributeCanary]]">${literal}</${tag.toUpperCase()}> [[Visible]]`],
 [`${tag}: self closing`, `<${tag} data-test="${'x'.repeat(250)}"/> [[Visible]]`],
 [`${tag}: unclosed`, `[[Visible]] <${tag}>${literal}`]
])
test.each(cases)('literal regions preserve visible links without literal edges: %s', (_,text) => {
 const out = extractGraph({...base,text})
 expect(out.links).toEqual([{target:'Visible'}])
 expect(out.categories).toEqual([])
 expect(out.parse_status).toBe('ok')
})
test.each(['nowiki','pre','source','syntaxhighlight','templatedata'])('redirect categories exclude %s before library early-return', tag => {
 const out = extractGraph({...base,text:`#REDIRECT [[Visible]]\n<${tag}>${literal}</${tag}> [[Category:VisibleCategory]]`})
 expect(out.redirect_target).toBe('Visible')
 expect(out.categories).toEqual(['VisibleCategory'])
})
test.each([
 `<!-- ${literal} --> [[Visible]]`,
 `[[Visible]] <!-- ${literal}`,
 `<!-- <nowiki> --> [[Visible]]`,
 `<nowiki><!-- ${literal} --></nowiki> [[Visible]]`
])('comments and literal nesting cannot invent edges: %s', text => {
 const out = extractGraph({...base,text})
 expect(out.links).toEqual([{target:'Visible'}])
 expect(out.categories).toEqual([])
})
test('templatedata CLI emits only complete graph records, exact decimal IDs, no body/canary', () => {
 const canary = 'LITERAL_' + randomUUID()
 const text = `<templatedata>{"description":"${canary} [[LiteralTarget]] [[Category:LiteralCategory]]","params":{}}</templatedata> [[Visible]]`
 const result = spawnSync(process.execPath,[path.resolve(__dirname,'../graph-cli.js')],{input:JSON.stringify({...base,text})+'\n',encoding:'utf8'})
 expect(result.status).toBe(0)
 expect(result.stderr).toBe('')
 expect(JSON.parse(result.stdout)).toEqual({...base,links:[{target:'Visible'}],categories:[],redirect_target:null,parse_status:'ok'})
 expect(result.stdout + result.stderr).not.toContain(canary)
 expect(result.stdout + result.stderr).not.toContain(text)
})
