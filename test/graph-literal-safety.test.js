const {spawnSync} = require('node:child_process')
const {randomUUID} = require('node:crypto')
const path = require('node:path')
const {extractGraph} = require('../graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
const literal = '{"description":"[[LiteralTarget]] [[Category:LiteralCategory]]","params":{}}'
const cases = ['nowiki','pre','source','syntaxhighlight','templatedata'].flatMap(tag => [
 [`${tag}: paired`, `<${tag}>${literal}</${tag}> [[Visible]]`],
 [`${tag}: benign`, `<${tag}>benign contents</${tag}> [[Visible]]`],
 [`${tag}: redirect`, `#REDIRECT [[Visible]]\n<${tag}>${literal}</${tag}>`],
 [`${tag}: mixed case and long attributes`, `<${tag.toUpperCase()} data-test="${'x'.repeat(250)}">${literal}</${tag.toUpperCase()}> [[Visible]]`]
])
test.each(cases)('known unsupported literal markup fails closed: %s', (_,text) => {
 expect(() => extractGraph({...base,text})).toThrow('UNSUPPORTED_MARKUP')
})

test('templatedata emits neither invented edges nor body/canary/partial current CLI record', () => {
 const canary = 'LITERAL_' + randomUUID()
 const text = `<templatedata>{"description":"${canary} [[LiteralTarget]] [[Category:LiteralCategory]]","params":{}}</templatedata> [[Visible]]`
 const previous = {...base,text:'[[Previous]]'}
 const expectedPrefix = JSON.stringify(extractGraph(previous)) + '\n'
 for (const prefix of ['', JSON.stringify(previous) + '\n']) {
  const result = spawnSync(process.execPath,[path.resolve(__dirname,'../graph-cli.js')],{
   input:prefix + JSON.stringify({...base,text}) + '\n',encoding:'utf8'
  })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe(prefix ? expectedPrefix : '')
  expect(result.stderr).toBe(JSON.stringify({code:'UNSUPPORTED_MARKUP',request_id:prefix ? 2 : 1}) + '\n')
  expect(result.stdout + result.stderr).not.toContain(canary)
  expect(result.stdout + result.stderr).not.toContain(text)
 }
})
