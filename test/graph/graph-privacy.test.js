const fs = require('node:fs')
const {extractGraph} = require('../../src/graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
test('parser failures neither invoke crash recorder nor write source bodies', () => {
 const writes = jest.spyOn(fs,'writeFileSync')
 const consoleError = jest.spyOn(console,'error')
 const canary = 'TRANSIENT_' + Date.now()
 try {
  expect(() => extractGraph({...base,text:`${canary} {{percentage|1|2|decimals=101}}`})).toThrow('PARSE_ERROR')
  expect(writes).not.toHaveBeenCalled()
  expect(consoleError).not.toHaveBeenCalled()
  expect(Object.keys(require.cache).some(p => p.endsWith('/crash-case.js'))).toBe(false)
 } finally {writes.mockRestore();consoleError.mockRestore()}
})
test('no extra XML entity decoding and ignored markup stays ignored', () => {
 expect(extractGraph({...base,text:'[[A&amp;amp;B]]'}).links).toEqual([{target:'A&amp;B'}])
 expect(extractGraph({...base,text:'<nowiki>[[分类:Private]] [[Secret]]</nowiki> [[Visible]]'})).toMatchObject({links:[{target:'Visible'}],categories:[]})
})
