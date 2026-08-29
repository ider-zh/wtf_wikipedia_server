const fs = require('fs');
const path = require('path');
const extractFull = require('../worker_full');
const extractTiny = require('../worker_tiny');
const { CRASH_CASE_DIR } = require('../crashCase');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

/**
 * 收集需要回放的样例：
 * 1. data/crash-cases/*.txt —— 线上崩溃时由 crashCase.js 落盘的完整输入
 * 2. data/wikitext_*.txt   —— 仓库内已有的真实条目样例
 */
function listFixtures() {
    const fixtures = [];
    try {
        if (fs.existsSync(CRASH_CASE_DIR)) {
            for (const f of fs.readdirSync(CRASH_CASE_DIR)) {
                if (f.endsWith('.txt')) {
                    fixtures.push({ name: `crash-cases/${f}`, file: path.join(CRASH_CASE_DIR, f) });
                }
            }
        }
    } catch (e) {
        // 目录不可读时忽略，不阻塞测试
    }
    for (const f of ['wikitext_1.txt', 'wikitext_2.txt']) {
        const p = path.join(DATA_DIR, f);
        if (fs.existsSync(p)) {
            fixtures.push({ name: f, file: p });
        }
    }
    return fixtures;
}

const fixtures = listFixtures();

describe('crash case replay', () => {
    if (fixtures.length === 0) {
        test('no crash cases captured yet', () => {
            expect(fixtures).toHaveLength(0);
        });
        return;
    }

    test.each(fixtures)('replays $name without throwing', ({ file }) => {
        const content = fs.readFileSync(file, 'utf8');
        expect(content.length).toBeGreaterThan(0);

        // full / tiny 两种模式都必须不再抛错，且输出合法 JSON
        expect(() => extractFull(content)).not.toThrow();
        expect(() => extractTiny(content)).not.toThrow();
        expect(() => JSON.parse(extractFull(content))).not.toThrow();
        expect(() => JSON.parse(extractTiny(content))).not.toThrow();
    });
});
