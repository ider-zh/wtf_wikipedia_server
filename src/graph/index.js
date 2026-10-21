'use strict'
const wtf = require('wtf_wikipedia')
const {maskLiteralMarkup} = require('./markup')
const {imageCaptionTargets, ordinaryLinkTargets, dynamicCategoryTargets} = require('./ast')
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024
class GraphError extends Error {
  constructor(code) { super(code); this.code = code }
}
// Conservative output boundary, not a wikitext parser or full title validator.
function isSafeTitle(value) {
  return typeof value === 'string' && !/[\[\]{}<>|\u0000-\u001f\u007f]/u.test(value)
}
function normalizeTarget(value) {
  // Check before fragment removal so malformed suffixes cannot be hidden.
  if (!isSafeTitle(value)) throw new GraphError('PARSE_ERROR')
  return value.replace(/^:/, '').split('#', 1)[0].replace(/_/g, ' ').trim()
}
function extractGraph(input, {maxBytes = DEFAULT_MAX_BYTES, diagnostics} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_BYTES) throw new GraphError('INVALID_OPTIONS')
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !['page_id','revision_id'].every(k => typeof input[k] === 'string' && /^\d+$/.test(input[k]) || Number.isSafeInteger(input[k]) && input[k] >= 0) ||
      !Number.isInteger(input.ns) || !isSafeTitle(input.title) || typeof input.timestamp !== 'string' ||
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
  const saved = {}
  try {
    // The library is synchronous. Suppress its diagnostics only in this opt-in path.
    for (const k of ['log','warn','error','info','debug','trace']) { saved[k] = console[k]; console[k] = () => {} }
    // Preserve the required WTF parser and its namespace/directive semantics;
    // ambiguous ordinary links are reconciled through the sandboxed AST below.
    const source = maskLiteralMarkup(input.text).replace(/^(\s*#)重新導向(?=\s*\[\[)/iu, '$1REDIRECT')
      .replace(/\[\[\s*(?:文件|檔案)\s*:/gu, '[[File:')
    const doc = wtf(source.replace(/\[\[\s*(?:Category|分类|分類)\s*:/giu, '[[Category:\u200b'))
    const unique = new Map()
    // wtf 10.4.2 flattens caption links before Image.links(); use a real
    // wikitext AST for those image subtrees, never caption/body regex surgery.
    let unresolved = 0
    const captionLinks = doc.images().flatMap(image => {
      const parsed = imageCaptionTargets(image.wikitext())
      unresolved += parsed.unresolved
      return parsed.targets.map(page => ({data:{type:'internal',page}}))
    })
    let links = [...doc.links(), ...captionLinks]
    const ambiguous = links.filter(link => link.data.type === 'internal' &&
      typeof link.data.page === 'string' && !isSafeTitle(link.data.page))
    if (ambiguous.length) {
      // WTF's approximate splitter can put bracket/label text into the page
      // field. Reconcile the entire page through the real AST, never trim a
      // broken candidate into an invented edge or bypass normalizeTarget.
      const parsed = ordinaryLinkTargets(source, ambiguous.map(link =>
        typeof link.wikitext === 'function' ? link.wikitext() : ''))
      links = parsed.targets.map(page => ({data:{type:'internal',page}}))
      // Whole-page AST includes captions; replace rather than double count.
      unresolved = parsed.unresolved
      if (diagnostics) {
        diagnostics.ast_reconciliations = (diagnostics.ast_reconciliations || 0) + 1
        diagnostics.parser_nonlinks = (diagnostics.parser_nonlinks || 0) + parsed.nonlinks
      }
    }
    for (const link of links) {
      if (link.data.type !== 'internal' || typeof link.data.page !== 'string') continue
      const target = normalizeTarget(link.data.page)
      if (!target) continue
      const item = {target}
      if (/^(Category|分类|分類):/iu.test(target)) item.namespace = 14
      unique.set(target, item)
    }
    out.links = [...unique.values()].sort((a,b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0)
    let dynamicCategories
    const categories = []
    for (const value of doc.categories()) {
      const candidate = value.replace(/^\u200b/, '')
      if (!isSafeTitle(candidate)) {
        // Reconcile only unsafe WTF membership candidates, and only against
        // exact AST-proven dynamic targets modulo namespace/outer whitespace.
        // No expression truncation, underscore/fragment removal or folding
        // of target case is permitted. Unmatched unsafe values remain fatal.
        if (!dynamicCategories) dynamicCategories = dynamicCategoryTargets(source)
        if (dynamicCategories.has(candidate.trim())) { unresolved++; continue }
      }
      const target = normalizeTarget(candidate)
      if (target) categories.push(target)
    }
    out.categories = [...new Set(categories)].sort()
    if (unresolved) {
      out.parse_status = 'partial_unresolved_target'
      if (diagnostics) diagnostics.unresolved_dynamic_targets = (diagnostics.unresolved_dynamic_targets || 0) + unresolved
    }
    const redirect = doc.isRedirect() && doc.redirectTo()
    const target = redirect && redirect.page
    out.redirect_target = typeof target === 'string' ? normalizeTarget(target) || null : null
    return out
  } catch (_) { throw new GraphError('PARSE_ERROR') }
  finally { for (const k of Object.keys(saved)) console[k] = saved[k] }
}
module.exports = {extractGraph, GraphError, DEFAULT_MAX_BYTES}
