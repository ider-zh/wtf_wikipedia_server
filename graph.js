'use strict'
const wtf = require('wtf_wikipedia')
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024
class GraphError extends Error {
  constructor(code) { super(code); this.code = code }
}
function normalizeTarget(value) {
  return value.replace(/^:/, '').split('#', 1)[0].replace(/_/g, ' ').trim()
}
function extractGraph(input, {maxBytes = DEFAULT_MAX_BYTES} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !['page_id','revision_id'].every(k => typeof input[k] === 'string' && /^\d+$/.test(input[k]) || Number.isSafeInteger(input[k]) && input[k] >= 0) ||
      !Number.isInteger(input.ns) || typeof input.title !== 'string' || typeof input.timestamp !== 'string' ||
      !['present','empty','hidden','missing'].includes(input.text_state) ||
      (input.redirect_target != null && typeof input.redirect_target !== 'string')) throw new GraphError('INVALID_RECORD')
  const out = {page_id:input.page_id,ns:input.ns,title:input.title,revision_id:input.revision_id,timestamp:input.timestamp,text_state:input.text_state,links:[],categories:[],redirect_target:null,parse_status:'ok'}
  if (input.text_state === 'hidden' || input.text_state === 'missing') {
    if (input.text != null && input.text !== '') throw new GraphError('INVALID_TEXT_STATE')
    out.parse_status = 'unavailable'; return out
  }
  if (typeof input.text !== 'string') throw new GraphError('INVALID_TEXT')
  if (Buffer.byteLength(input.text, 'utf8') > maxBytes) throw new GraphError('TEXT_TOO_LARGE')
  if (input.text_state === 'empty' && input.text !== '') throw new GraphError('INVALID_TEXT_STATE')
  // XML selectors distinguish available text from missing/hidden, even at length zero.
  if (input.text === '') return out
  // wtf 10.4.2 interprets links inside literal-extension tags as graph edges.
  // Refuse these records rather than inventing another wikitext parser here.
  if (/<\s*(?:nowiki|pre|source|syntaxhighlight)\b/iu.test(input.text)) throw new GraphError('UNSUPPORTED_MARKUP')
  const saved = {}
  try {
    // The library is synchronous. Suppress its diagnostics only in this opt-in path.
    for (const k of ['log','warn','error','info','debug','trace']) { saved[k] = console[k]; console[k] = () => {} }
    // Alias only the redirect directive; all wikitext/link/category parsing is wtf.
    const doc = wtf(input.text.replace(/^(\s*#)重新導向(?=\s*\[\[)/iu, '$1REDIRECT')
      .replace(/\[\[\s*(?:Category|分类|分類)\s*:/giu, '[[Category:\u200b'))
    const unique = new Map()
    for (const link of doc.links()) {
      if (link.data.type !== 'internal' || typeof link.data.page !== 'string') continue
      const target = normalizeTarget(link.data.page)
      if (!target) continue
      const item = {target}
      if (/^(Category|分类|分類):/iu.test(target)) item.namespace = 14
      unique.set(target, item)
    }
    out.links = [...unique.values()].sort((a,b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0)
    out.categories = [...new Set(doc.categories().map(c => normalizeTarget(c.replace(/^\u200b/, ''))).filter(Boolean))].sort()
    const redirect = doc.isRedirect() && doc.redirectTo()
    const target = redirect && redirect.page
    out.redirect_target = typeof target === 'string' ? normalizeTarget(target) || null : null
    return out
  } catch (_) { throw new GraphError('PARSE_ERROR') }
  finally { for (const k of Object.keys(saved)) console[k] = saved[k] }
}
module.exports = {extractGraph, GraphError, DEFAULT_MAX_BYTES}
