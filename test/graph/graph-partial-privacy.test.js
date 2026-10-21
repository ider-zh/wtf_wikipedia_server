const fs = require('node:fs')
const path = require('node:path')
const {randomUUID} = require('node:crypto')
const {spawnSync} = require('node:child_process')
const {extractGraph} = require('../../src/graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present'}
const cli = path.resolve(__dirname,'../../bin/graph.js')

function partial(canary) {
 return {...base,text:`BODY_${canary} [[Bad[Caption]] [[{{${canary}|a|b}}]] [[Confirmed]] [[Category:Member]]`}
}

test('partial AST classification does not log, retain bodies or load the crash recorder', () => {
 const canary = randomUUID()
 const consoles = ['log','warn','error','info','debug','trace'].map(k => jest.spyOn(console,k))
 const writes = ['writeFileSync','appendFileSync','writeFile','appendFile'].map(k => jest.spyOn(fs,k))
 try {
  const out = extractGraph(partial(canary))
  expect(out.parse_status).toBe('partial_unresolved_target')
  expect(JSON.stringify(out)).not.toContain(canary)
  for (const spy of [...consoles,...writes]) expect(spy).not.toHaveBeenCalled()
  expect(Object.keys(require.cache).some(p => p.endsWith('/crash-case.js') || p.endsWith('/wikiparser-node/dist/index.js'))).toBe(false)
 } finally { for (const spy of [...consoles,...writes]) spy.mockRestore() }
})

test('CLI preserves a valid prefix, emits a partial record, continues, and keeps text-state semantics', () => {
 const canary = randomUUID()
 const records = [
  {...base,text:'[[Previous]]'},partial(canary),{...base,text:'[[Following]]'},
  {...base,text_state:'present',text:''},{...base,text_state:'empty',text:''},
  {...base,text_state:'hidden'},{...base,text_state:'missing'}
 ]
 const dir = fs.mkdtempSync(path.join(process.env.TMPDIR,'graph-partial-'))
 try {
  const result = spawnSync(process.execPath,[cli],{input:records.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',cwd:dir})
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  const output = result.stdout.trim().split('\n').map(JSON.parse)
  expect(output).toHaveLength(records.length)
  expect(output.map(o => o.parse_status)).toEqual(['ok','partial_unresolved_target','ok','ok','ok','unavailable','unavailable'])
  expect(output[1]).toEqual({...base,links:[{target:'Confirmed'}],categories:['Member'],redirect_target:null,parse_status:'partial_unresolved_target'})
  expect(output[0].links).toEqual([{target:'Previous'}])
  expect(output[2].links).toEqual([{target:'Following'}])
  expect(output.slice(3).map(o => o.text_state)).toEqual(['present','empty','hidden','missing'])
  expect(result.stdout + result.stderr).not.toContain(canary)
  expect(result.stdout).not.toContain('unresolved_dynamic_targets')
  expect(fs.readdirSync(dir)).toEqual([])
 } finally {fs.rmSync(dir,{recursive:true})}
})

// AST-proven dynamic categories now share the partial contract; static braces do not.
test.each(['[[Bad[Caption]] [[{{x}}]] [[A\u0001B]]','[[Category:Bad{x}]]','#REDIRECT [[Bad{{x}}]]','{{percentage|1|2|decimals=101}}'])(
 'partial policy does not suppress a subsequent fatal parser/title error: %s', bad => {
  const canary = randomUUID()
  const prefix = [{...base,text:'[[Previous]]'},partial(canary)]
  const result = spawnSync(process.execPath,[cli],{input:[...prefix,{...base,text:`${bad}\nBODY_${canary}`}].map(JSON.stringify).join('\n')+'\n',encoding:'utf8'})
  expect(result.status).toBe(1)
  expect(result.stdout).toBe(prefix.map(record => JSON.stringify(extractGraph(record))).join('\n')+'\n')
  expect(result.stderr).toBe('{"code":"PARSE_ERROR","request_id":3}\n')
  expect(result.stdout + result.stderr).not.toContain(canary)
 })
