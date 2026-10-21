const {spawnSync} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const base = {page_id:'1',ns:0,title:'MixedCase',revision_id:'2',timestamp:'2001-03-31T23:59:59Z',text_state:'present'}
test('selected revision redirect ignores export-time metadata; unavailable is not empty', () => {
 const {extractGraph} = require('../graph')
 for (const directive of ['REDIRECT','重定向','重新導向']) expect(extractGraph({...base,text:`#${directive} [[Historical_Target#fragment]]`,redirect_target:'WrongCurrent'}).redirect_target).toBe('Historical Target')
 expect(extractGraph({...base,text:'[[Normal]]',redirect_target:'WrongCurrent'}).redirect_target).toBeNull()
 for (const text_state of ['hidden','missing']) expect(extractGraph({...base,text_state,redirect_target:'WrongCurrent'})).toEqual({...base,text_state,links:[],categories:[],redirect_target:null,parse_status:'unavailable'})
 expect(extractGraph({...base,text_state:'empty',text:''}).parse_status).toBe('ok')
 expect(() => extractGraph({...base,text_state:'empty',text:'not empty'})).toThrow('INVALID_TEXT_STATE')
})
test('XML selector present-empty text is available and faithfully preserved through the CLI', () => {
 const input = {...base,text:'',redirect_target:'WrongCurrent'}
 const result = spawnSync(process.execPath,[path.resolve(__dirname,'../graph-cli.js')],{input:JSON.stringify(input)+'\n',encoding:'utf8'})
 expect(result.status).toBe(0)
 expect(result.stderr).toBe('')
 expect(JSON.parse(result.stdout)).toEqual({...base,links:[],categories:[],redirect_target:null,parse_status:'ok'})
})
test('CLI bounds serialized UTF-8 bytes including metadata and JSON escaping, excluding LF', () => {
 const cli = path.resolve(__dirname,'../graph-cli.js')
 const input = {...base,text:'<>& 中文\n"\\'}
 const compact = JSON.stringify(input)
 const escaped = compact.replace(/[<>&]/g, c => '\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))
 expect(JSON.parse(escaped)).toEqual(input)
 expect(Buffer.byteLength(escaped)).toBeGreaterThan(Buffer.byteLength(compact))
 const run = (line,limit) => spawnSync(process.execPath,[cli,'--max-line-bytes',String(limit)],{input:line+'\n',encoding:'utf8'})
 const accepted = run(compact,Buffer.byteLength(compact))
 expect(accepted.status).toBe(0)
 expect(accepted.stderr).toBe('')
 const expanded = run(escaped,Buffer.byteLength(escaped))
 expect(expanded.status).toBe(0)
 expect(expanded.stderr).toBe('')
 expect(expanded.stdout).toBe(accepted.stdout)
 for (const [line,limit] of [[compact,Buffer.byteLength(compact)-1],[escaped,Buffer.byteLength(compact)]]) {
  const rejected = run(line,limit)
  expect(rejected.status).toBe(1)
  expect(rejected.stdout).toBe('')
  expect(JSON.parse(rejected.stderr)).toEqual({code:'LINE_TOO_LARGE',request_id:1})
 }
})
test('CLI is bounded, fail closed, graph-only and leaves no files', () => {
 const cwd = fs.mkdtempSync(path.join(process.env.TMPDIR || '.', 'graph-test-'))
 const canary = 'PRIVACY_' + Date.now()
 const cli = path.resolve(__dirname,'../graph-cli.js')
 const run = (input,args=[]) => spawnSync(process.execPath,[cli,...args],{input,encoding:'utf8',cwd})
 try {
  const valid = run([JSON.stringify({...base,text:`${canary} [[Safe|${canary}]]`}),JSON.stringify({...base,text_state:'hidden'})].join('\n'))
  expect(valid.status).toBe(0); expect(valid.stderr).toBe('')
  const records = valid.stdout.trim().split('\n').map(JSON.parse)
  expect(records).toHaveLength(2)
  records.forEach(r => expect(Object.keys(r).sort()).toEqual(['page_id','ns','title','revision_id','timestamp','text_state','links','categories','redirect_target','parse_status'].sort()))
  expect(valid.stdout).not.toContain(canary)
  for (const [input,args,code] of [[`{${canary}`,[],'INVALID_JSON'],[JSON.stringify({...base,text:{[canary]:1}}),[],'INVALID_TEXT'],[JSON.stringify({...base,text:canary.repeat(20)}),['--max-line-bytes','128'],'LINE_TOO_LARGE'],[JSON.stringify({...base,text:`${canary} {{percentage|1|2|decimals=101}}`}),[],'PARSE_ERROR']]) {
   const result = run(input,args)
   expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain(canary)
   expect(JSON.parse(result.stderr)).toMatchObject({code,request_id:1})
  }
  expect(fs.readdirSync(cwd)).toEqual([])
 } finally {fs.rmdirSync(cwd)}
})
