'use strict'
const fs = require('node:fs')
const path = require('node:path')
const {spawnSync} = require('node:child_process')
const root = path.resolve(__dirname, '..')
const base = {page_id:'1',revision_id:'2',ns:0,title:'Title',timestamp:'2001-03-31T23:59:59Z',text_state:'present'}
const run = (entry, input = '', args = []) => spawnSync(process.execPath, [path.join(root, entry), ...args], {
  input, encoding:'utf8', timeout:10000, cwd:root
})

test('implementations have one canonical location and root entrypoints are thin shims', () => {
  const entries = {
    'expressServer.js':'src/http/server.js', 'grpcServer.js':'src/grpc/server.js',
    'grpcClient.js':'examples/grpc-client.js', 'worker_full.js':'src/workers/full.js',
    'worker_tiny.js':'src/workers/tiny.js', 'graph.js':'src/graph/index.js', 'graph-cli.js':'bin/graph.js'
  }
  for (const [legacy, canonical] of Object.entries(entries)) {
    expect(fs.existsSync(path.join(root, canonical))).toBe(true)
    const shim = fs.readFileSync(path.join(root, legacy), 'utf8')
    expect(shim.split('\n').length).toBeLessThanOrEqual(12)
    expect(shim).toContain('require(')
    expect(shim).not.toMatch(/wtf_wikipedia|new Piscina|new grpc\.Server|extractGraph\(input/)
  }
  for (const helper of ['src/shared/sanitize.js','src/shared/crash-case.js','src/graph/ast.js','src/graph/markup.js']) {
    expect(fs.existsSync(path.join(root, helper))).toBe(true)
  }
  for (const helper of ['sanitize.js','crashCase.js','graph-images.js','graph-markup.js']) {
    expect(fs.existsSync(path.join(root, helper))).toBe(false)
  }
  expect(fs.readdirSync(root).filter(name => name.endsWith('.js')).sort()).toEqual(Object.keys(entries).sort())
})

test('package entrypoint and npm commands target canonical modules without new dependencies', () => {
  const pkg = require('../package.json')
  expect(pkg.main).toBe('src/graph/index.js')
  expect(pkg.scripts).toMatchObject({
    http:'node src/http/server.js', grpc:'node src/grpc/server.js',
    'grpc:full':'node src/grpc/server.js --worker full', 'grpc:tiny':'node src/grpc/server.js --worker tiny',
    grpcTest:'node examples/grpc-client.js', graph:'node bin/graph.js', test:'node node_modules/jest/bin/jest.js'
  })
  expect(require('..')).toBe(require('../src/graph'))
})

test('legacy graph and worker imports return the canonical exports', () => {
  expect(require('../graph')).toBe(require('../src/graph'))
  for (const mode of ['full','tiny']) {
    expect(require(`../worker_${mode}`)).toBe(require(`../src/workers/${mode}`))
  }
  expect(require('../graph-cli')).toBe(require('../bin/graph'))
  expect(require('../expressServer')).toBe(require('../src/http/server'))
  expect(require('../src/shared/crash-case').CRASH_CASE_DIR).toBe(path.join(root,'data/crash-cases'))
})

test.each(['src/http/server.js','expressServer.js','src/grpc/server.js','grpcServer.js','bin/graph.js','graph-cli.js'])(
  'importing %s does not start services or consume stdin', entry => {
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root,entry))})`], {
      encoding:'utf8',timeout:5000,cwd:root
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

test.each([
  ['valid graph', JSON.stringify({...base,text:'[[Visible]] [[Category:Member]]'})+'\n', [], 0, null],
  ['partial graph', JSON.stringify({...base,text:'[[Confirmed]] [[Category:{{x}}]]'})+'\n', [], 0, null],
  ['invalid JSON', '{invalid\n', [], 1, 'INVALID_JSON'],
  ['invalid options', '', ['--unknown'], 1, 'INVALID_OPTIONS'],
  ['line bound', JSON.stringify({...base,text:'[[Visible]]'})+'\n', ['--max-line-bytes','1'], 1, 'LINE_TOO_LARGE'],
  ['parse failure', JSON.stringify({...base,text:'[[Category:Bad{Static}]]'})+'\n', [], 1, 'PARSE_ERROR']
])('canonical and compatibility graph CLIs preserve %s bytes and status', (_,input,args,status,code) => {
  const canonical = run('bin/graph.js',input,args)
  const legacy = run('graph-cli.js',input,args)
  expect(canonical.error).toBeUndefined()
  expect(legacy.error).toBeUndefined()
  expect(canonical.status).toBe(status)
  expect(legacy.status).toBe(canonical.status)
  expect(legacy.stdout).toBe(canonical.stdout)
  expect(legacy.stderr).toBe(canonical.stderr)
  if (code) expect(JSON.parse(canonical.stderr)).toEqual({code,request_id:1})
  else {
    expect(canonical.stderr).toBe('')
    expect(JSON.parse(canonical.stdout)).toEqual(require('../src/graph').extractGraph(JSON.parse(input)))
  }
})

test('npm graph is a quiet JSONL command equivalent to the canonical CLI', () => {
  const input = JSON.stringify({...base,text:'[[Visible]]'})+'\n'
  const result = spawnSync('npm',['run','--silent','graph'],{input,encoding:'utf8',timeout:10000,cwd:root})
  const canonical = run('bin/graph.js',input)
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout).toBe(canonical.stdout)
})

test('suites are grouped by graph, services, workers and regression', () => {
  for (const group of ['graph','services','workers','regression']) {
    expect(fs.readdirSync(path.join(root,'test',group)).some(name => name.endsWith('.test.js'))).toBe(true)
  }
  expect(fs.readdirSync(path.join(root,'test')).filter(name => name.endsWith('.test.js'))).toEqual(['project-layout.test.js'])
})
