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
 expect(() => extractGraph({...base,text:''})).toThrow('INVALID_TEXT_STATE')
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
