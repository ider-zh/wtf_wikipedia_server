'use strict'
const {extractGraph, GraphError, DEFAULT_MAX_BYTES} = require('./graph')
const {once} = require('node:events')
const {TextDecoder} = require('node:util')
async function main() {
  let requestId = 1
  try {
    const args = process.argv.slice(2)
    let maxBytes = DEFAULT_MAX_BYTES
    if (args.length) {
      if (args.length !== 2 || args[0] !== '--max-line-bytes' || !/^\d+$/.test(args[1])) throw new GraphError('INVALID_OPTIONS')
      maxBytes = Number(args[1])
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_BYTES) throw new GraphError('INVALID_OPTIONS')
    }
    const decoder = new TextDecoder('utf-8', {fatal:true})
    let chunks = [], size = 0
    async function record() {
      let value
      try { value = JSON.parse(decoder.decode(Buffer.concat(chunks, size))) }
      catch (_) { throw new GraphError('INVALID_JSON') }
      chunks = []; size = 0
      const output = JSON.stringify(extractGraph(value, {maxBytes})) + '\n'
      value = null
      if (!process.stdout.write(output)) await once(process.stdout, 'drain')
      requestId++
    }
    // Async iteration pauses stdin while parsing and while stdout is backpressured.
    for await (const chunk of process.stdin) {
      let start = 0
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] !== 10) continue
        const part = chunk.subarray(start, i)
        if (size + part.length > maxBytes) throw new GraphError('LINE_TOO_LARGE')
        chunks.push(part); size += part.length
        await record(); start = i + 1
      }
      if (start < chunk.length) {
        const part = chunk.subarray(start)
        if (size + part.length > maxBytes) throw new GraphError('LINE_TOO_LARGE')
        chunks.push(part); size += part.length
      }
    }
    if (size) await record()
  } catch (error) {
    process.stderr.write(JSON.stringify({code:error instanceof GraphError ? error.code : 'IO_ERROR',request_id:requestId}) + '\n')
    process.exitCode = 1
    process.stdin.destroy()
  }
}
// No HTTP/gRPC worker, crash recorder, entity decoder, body logger or file writer.
if (require.main === module) main()
module.exports = {main}
