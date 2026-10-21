const {spawnSync} = require('node:child_process')
const {randomUUID} = require('node:crypto')
const path = require('node:path')
const {extractGraph} = require('../graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}

test.each([
 ['localized image caption', '[[文件:Image.jpg|thumb|CAPTIONCANARY [[NestedLink|display]]]]'],
 ['link pipe', '[[Bad|pipe|tail]]'],
 ['category braces', '[[Category:Bad{{caption}}]]'],
 ['redirect markup', '#REDIRECT [[Bad<em>Caption</em>]]'],
 ['redirect braces', '#REDIRECT [[Bad{{caption}}]]'],
 ['link bracket', '[[Bad[Caption]]']
])('invalid parsed title fails the entire synchronous record: %s', (_,text) => {
 expect(() => extractGraph({...base,text})).toThrow('PARSE_ERROR')
})

test.each(['Bad|Caption','Bad[Caption]','Bad{Caption}','Bad<em>Caption</em>','Bad\u0000Caption','Bad\nCaption','Bad\u007fCaption'])(
 'invalid copied page title is rejected without reflecting it: %s', title => {
  expect(() => extractGraph({...base,title,text:''})).toThrow('INVALID_RECORD')
 })

test('invalid output title cannot leak a body or a partial current record through the CLI', () => {
 const canary = 'CAPTION_' + randomUUID()
 const text = `BODY_${canary} [[SafeCurrent]] [[文件:Image.jpg|thumb|${canary} [[NestedLink|display]]]]`
 const previous = {...base,text:'[[Previous]]'}
 const expectedPrefix = JSON.stringify(extractGraph(previous)) + '\n'
 for (const prefix of ['', JSON.stringify(previous) + '\n']) {
  const result = spawnSync(process.execPath,[path.resolve(__dirname,'../graph-cli.js')],{
   input:prefix + JSON.stringify({...base,text}) + '\n',encoding:'utf8'
  })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe(prefix ? expectedPrefix : '')
  expect(result.stderr).toBe(JSON.stringify({code:'PARSE_ERROR',request_id:prefix ? 2 : 1}) + '\n')
  expect(result.stdout + result.stderr).not.toContain(canary)
  expect(result.stdout + result.stderr).not.toContain(text)
  expect(result.stdout).not.toContain('SafeCurrent')
 }
})
