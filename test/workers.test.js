const extractFull = require('../worker_full');
const extractTiny = require('../worker_tiny');

const SAMPLE = '[[Apple]] is a [[Category:Fruit]] fruit, also see [[Banana]].';

describe('worker_full', () => {
    test('returns a valid JSON string with full data shape', () => {
        const out = JSON.parse(extractFull(SAMPLE));
        expect(typeof out.plaintext).toBe('string');
        expect(out).toHaveProperty('links');
        expect(out.links.internal).toEqual(
            expect.arrayContaining([{ page: 'Apple' }, { page: 'Banana' }])
        );
        expect(out.categories).toContain('Fruit');
    });

    test('does not throw on empty input and still yields valid JSON', () => {
        expect(() => extractFull('')).not.toThrow();
        const out = JSON.parse(extractFull(''));
        expect(out).toHaveProperty('plaintext');
    });
});

describe('worker_tiny', () => {
    test('returns categories and links only (no plaintext/sections)', () => {
        const out = JSON.parse(extractTiny(SAMPLE));
        expect(out.categories).toContain('Fruit');
        expect(out.links.internal).toEqual(
            expect.arrayContaining([{ page: 'Apple' }, { page: 'Banana' }])
        );
        // tiny mode disables plaintext/sections in the underlying doc.json()
        expect(out).not.toHaveProperty('plaintext');
        expect(out).not.toHaveProperty('sections');
    });

    test('does not throw on empty input', () => {
        expect(() => extractTiny('')).not.toThrow();
    });
});

describe('wtf_wikipedia percentage() crash workaround', () => {
    const TEMPLATES = [
        '{{percentage|1|2|decimals=200}}',
        '{{percentage|1|2|decimals=2.5}}',
        '{{percentage|1|2|200}}',
        '{{percent-done|done=1|total=2|digits=200}}',
    ];
    test.each(TEMPLATES)('full worker does not throw on %s', (t) => {
        expect(() => extractFull(t)).not.toThrow();
        const out = JSON.parse(extractFull(t));
        expect(out).toHaveProperty('plaintext');
    });
    test.each(TEMPLATES)('tiny worker does not throw on %s', (t) => {
        expect(() => extractTiny(t)).not.toThrow();
        const out = JSON.parse(extractTiny(t));
        expect(typeof out).toBe('object');
    });
});
