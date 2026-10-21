const {extractGraph} = require('../../src/graph')
const {spawnSync} = require('node:child_process')
const path = require('node:path')
const base = {page_id:'1',revision_id:'9007199254740993',ns:0,title:'Title',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
test.each(['File','文件','檔案'])('%s image captions contribute real links, never caption fragments', alias => {
 const text = `[[${alias}:Image.jpg|thumb|CAPTION_CANARY [[NestedLink|display]] and [[Other]]]] [[Visible]]`
 const out = extractGraph({...base,text})
 expect(out.links).toEqual([{target:'NestedLink'},{target:'Other'},{target:'Visible'}])
 expect(out.categories).toEqual([])
 expect(JSON.stringify(out)).not.toContain('CAPTION_CANARY')
 const cli = spawnSync(process.execPath,[path.resolve(__dirname,'../../bin/graph.js')],{input:JSON.stringify({...base,text})+'\n',encoding:'utf8'})
 expect(cli.status).toBe(0)
 expect(cli.stderr).toBe('')
 expect(JSON.parse(cli.stdout)).toEqual(out)
})
