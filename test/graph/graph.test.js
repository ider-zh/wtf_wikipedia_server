const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const base = {page_id:'123',ns:0,title:'MixedCase',revision_id:'9007199254740993',timestamp:'2001-03-31T23:59:59Z',text_state:'present'}
const keys = ['page_id','ns','title','revision_id','timestamp','text_state','links','categories','redirect_target','parse_status'].sort()
test('real library graph extraction preserves identity and only emits allowlisted fields', () => {
  const {extractGraph} = require('../../src/graph')
  const out = extractGraph({...base,text:'[[Mixed_Case#Section|private anchor]] [[分类:甲]] [[分類:乙]] [[Category:Gamma]] [[:Category:Escaped]] [[Mixed Case]]'})
  expect(Object.keys(out).sort()).toEqual(keys)
  expect(out).toMatchObject({...base,links:[{target:'Category:Escaped',namespace:14},{target:'Mixed Case'}],categories:['Gamma','乙','甲'],redirect_target:null,parse_status:'ok'})
  expect(JSON.stringify(out)).not.toContain('private anchor')
})
