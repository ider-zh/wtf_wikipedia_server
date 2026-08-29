/**
 * 崩溃样例落盘模块
 *
 * 目的：把线上真实触发解析异常的 wikitext 完整保存下来，
 *       使其可以直接作为回归测试用例（由 test/crash-cases.test.js 自动回放）。
 *
 * 行为：
 * - 写入 data/crash-cases/<sha256 前 16 位>.txt
 * - 按内容 hash 去重，同一份输入只保存一次，避免磁盘被重复样例撑爆
 * - 超过 MAX_BYTES（默认 5MB）的输入跳过（仅记录一行提示）
 * - 任何落盘异常都被吞掉，绝不影响正常请求流程
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CRASH_CASE_DIR = path.resolve(__dirname, 'data/crash-cases');
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function recordCrashCase(wikiText, error) {
    try {
        if (typeof wikiText !== 'string' || wikiText.length === 0) return;
        const size = Buffer.byteLength(wikiText, 'utf8');
        if (size > MAX_BYTES) {
            console.error(`[crash-case] skipped: input too large (${size} bytes > ${MAX_BYTES})`);
            return;
        }
        const hash = crypto
            .createHash('sha256')
            .update(wikiText, 'utf8')
            .digest('hex')
            .slice(0, 16);

        fs.mkdirSync(CRASH_CASE_DIR, { recursive: true });
        const file = path.join(CRASH_CASE_DIR, `${hash}.txt`);
        if (fs.existsSync(file)) return; // 已记录过

        fs.writeFileSync(file, wikiText);
        console.error(`[crash-case] saved ${file} (${size} bytes): ${error && error.message}`);
    } catch (e) {
        // 落盘失败绝不能影响正常流程
        console.error('[crash-case] failed to save:', e && e.message);
    }
}

module.exports = { recordCrashCase, CRASH_CASE_DIR };
