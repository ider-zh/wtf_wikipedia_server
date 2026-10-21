/**
 * 修复 wtf_wikipedia 上游 bug：
 *   percentage() / percent-done() 模板会调用 num.toFixed(decimals)，
 *   当 decimals/digits 参数超出 [0,100] 或为非整数时会抛 RangeError，
 *   导致整条请求解析失败。
 *
 * 这里在把 wikitext 交给 wtf_wikipedia 之前做预处理：
 *   - clampParams: 将 named decimals=/digits= 钳制到 [0,100] 整数（覆盖常见用法）
 *   - stripPercentageTemplates: 兜底，移除 percentage / percent-done 系列模板
 *     （仅在解析仍然抛错时调用，尽量不影响正常页面的输出）
 */

// 将 percentage 家族模板的 decimals/digits 钳制到 [0,100] 整数
// 覆盖两种写法：
//   1) named 参数：{{percentage|...|decimals=200}}
//   2) 位置参数：{{Percentage|6|1|113}}  —— 第 3 个位置参数即 decimals
//
// 上游存在两处同类缺陷（wtf_wikipedia.cjs:5604 percentage 与 6167
// 'percent and number'），均以用户可控的 decimals 调用 toFixed()，
// 因此两个模板名都要覆盖。第三处 toFixed(1) 为硬编码常量，无风险。
function clampParams(text) {
    if (typeof text !== 'string') return '';
    // 1) named：decimals=N / digits=N
    text = text.replace(
        /\b(decimals|digits)\s*=\s*(-?[0-9]*\.?[0-9]+)/gi,
        (match, name, num) => {
            let n = Number(num);
            if (!Number.isFinite(n)) return match;
            n = Math.max(0, Math.min(100, Math.trunc(n)));
            return `${name}=${n}`;
        }
    );
    // 2) 位置参数：{{percentage|num|den|decimals}} 中的第 3 个参数
    text = text.replace(
        /(\{\{\s*percent(?:age|-done| and number)\s*\|[^|{}]*\|[^|{}]*\|)(-?[0-9]*\.?[0-9]+)/gi,
        (match, prefix, num) => {
            let n = Number(num);
            if (!Number.isFinite(n)) return match;
            n = Math.max(0, Math.min(100, Math.trunc(n)));
            return `${prefix}${n}`;
        }
    );
    return text;
}

// 移除 {{percentage|...}} 与 {{percent-done|...}}（含大小写变体），单层、非贪婪
function stripPercentageTemplates(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\{\{\s*percent(?:age|-done| and number)\b[^{}]*\}\}/gi, '');
}

module.exports = { clampParams, stripPercentageTemplates };
