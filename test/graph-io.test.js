const {spawnSync} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
test('stdout I/O failure has only a sanitized code, never an uncaught stack', () => {
 const fd = fs.openSync('/dev/full','w')
 try {
  const result = spawnSync(process.execPath,[path.resolve(__dirname,'../graph-cli.js')],{input:JSON.stringify({page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'x',text_state:'empty',text:''}),stdio:['pipe',fd,'pipe'],encoding:'utf8'})
  expect(result.status).toBe(1)
  expect(JSON.parse(result.stderr)).toEqual({code:'IO_ERROR',request_id:1})
 } finally {fs.closeSync(fd)}
})
