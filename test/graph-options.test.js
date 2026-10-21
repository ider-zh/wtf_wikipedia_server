const {extractGraph, GraphError, DEFAULT_MAX_BYTES} = require('../graph')
const base = {page_id:'1',ns:0,title:'Title',revision_id:'2',timestamp:'2001-01-01T00:00:00Z',text_state:'present',text:''}

test.each([
 ['NaN', NaN], ['Infinity', Infinity], ['negative Infinity', -Infinity],
 ['zero', 0], ['negative', -1], ['fraction', 1.5],
 ['over hard cap', DEFAULT_MAX_BYTES + 1], ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
 ['numeric string', '1'], ['null', null], ['boolean', true],
 ['object', {}], ['array', [1]], ['bigint', 1n], ['symbol', Symbol('private option')]
])('synchronous maxBytes rejects %s before every text-state shortcut', (_,maxBytes) => {
 for (const text_state of ['present','empty','hidden','missing']) {
  expect(() => extractGraph({...base,text_state},{maxBytes})).toThrow(GraphError)
  expect(() => extractGraph({...base,text_state},{maxBytes})).toThrow('INVALID_OPTIONS')
 }
})

test('synchronous maxBytes defaults and positive hard-cap boundaries are accepted', () => {
 for (const options of [undefined, {}, {maxBytes:undefined}, {maxBytes:1}, {maxBytes:DEFAULT_MAX_BYTES}]) {
  expect(extractGraph(base,options).parse_status).toBe('ok')
 }
 expect(extractGraph({...base,text:'a'},{maxBytes:1}).parse_status).toBe('ok')
 expect(() => extractGraph({...base,text:'中'},{maxBytes:2})).toThrow('TEXT_TOO_LARGE')
 expect(extractGraph({...base,text:'中'},{maxBytes:3}).parse_status).toBe('ok')
})
