# Graph-only JSONL 协议

[返回项目首页](../readme.md) · [接口选择](api.md) · [架构与目录](architecture.md)

此模式用于一次性管道批处理，不启动 HTTP/gRPC。以下输入、输出、失败和隐私契约与服务接口分别维护。

## 运行与发布输出

Run `node bin/graph.js` directly; this does **not** start or change the legacy HTTP/gRPC APIs. Install the locked dependencies with `npm ci --ignore-scripts`. If a mirror tarball is blocked by an installation-source policy, follow the [development guide](development.md) to inspect the lockfile and local policy rather than allowing all remote sources. Graph-only parsing uses `htmlparser2@10.0.0` and `wikiparser-node@1.48.0`.

```sh
# XML selection producer emits selected-revision records on stdout only.
selected-revision-command | node /path/to/wtf_wikipedia_server/bin/graph.js > graph.jsonl
# Smaller byte bound (default and hard maximum: 16777216 bytes per JSONL line):
selected-revision-command | node /path/to/wtf_wikipedia_server/bin/graph.js --max-line-bytes 1048576 > graph.jsonl
```

The producer/parent must check **both** process exit codes, consume stderr, and only publish output after successful EOF; a valid prefix can precede a later error. Do not write producer JSONL to a file: it contains transient source bodies. The CLI processes records sequentially, pauses stdin on stdout backpressure, accepts a final non-newline-terminated record, and rejects blank lines, invalid UTF-8/JSON and over-limit lines before parsing them. The bound includes JSON metadata/escaping, not just text, and excludes the terminating LF (a CR in CRLF still counts). `extractGraph`'s `maxBytes` instead bounds decoded UTF-8 text alone. Go's default JSON encoder escapes `<`, `>` and `&` to six-byte `\uXXXX` sequences; quotes, backslashes and control characters can also expand. Consequently the XML selector's decoded-text limit and this CLI's serialized-line limit are **not interchangeable**: a selector-accepted body can fail `LINE_TOO_LARGE`. Account for worst-case escaping (up to six times decoded text bytes), metadata and JSON framing when choosing a lower selector limit; the graph CLI hard cap remains 16 MiB. Do not silently raise it or strip/reencode source text to force admission. This is a bounded input queue, not a hard RSS or parser CPU-time bound.

## 输入与文本状态

Input: `{page_id, ns, title, revision_id, timestamp, text_state, text?, redirect_target?}`. IDs must be exact decimal strings or safe nonnegative JS integers (large IDs **must** be strings). Metadata is copied without lowercasing. `text_state` is `present` (any string, including the XML selector's present-empty `""`), `empty` (legacy explicit empty-string alias), `hidden` or `missing` (absent/null/empty text). Hidden/missing records emit `parse_status:"unavailable"`, no edges and null redirect; present/empty emit `"ok"` unless an AST-observed dynamic ordinary target or exactly reconciled dynamic category target makes the record `"partial_unresolved_target"` (below). Present-empty remains `text_state:"present"` with empty adjacency and null redirect; it is not relabeled missing, unavailable or empty. The producer must validate timestamp and namespace/source identity; the graph extractor does not reconstruct historical titles.

## 输出与同步调用

Output has **exactly** `{page_id,ns,title,revision_id,timestamp,text_state,links,categories,redirect_target,parse_status}`. `links` is a sorted deduplicated array of `{target,namespace?:integer}` (namespace 14 is reported for recognized Category/分类/分類 prefixes; other namespaces remain unresolved). Categories are sorted unique names **without** namespace prefixes. Fragments are removed; underscores become spaces; case is preserved. Escaped `[[:Category:...]]` is a page link, not membership. Redirects derive **only from selected wikitext**, including English `#REDIRECT`, Chinese `#重定向` and `#重新導向`; incoming export-time `redirect_target` is ignored.

`require('./src/graph').extractGraph(record, {maxBytes?})` is the independent synchronous export. `maxBytes` must be a finite positive safe integer no greater than 16777216 (default); invalid values fail with `INVALID_OPTIONS` before any text-state shortcut, including hidden/missing/present-empty records. It uses the real locked `wtf_wikipedia` parser, not the legacy workers or crash recorder. Namespace/directive aliases are normalized before the library call. A temporary zero-width prefix works around the library's two-character category minimum and is removed from category results. There is no additional `he.decode`: XML decoding belongs to the XML producer; the library retains its own entity semantics. The graph path does not serialize raw text, display anchors, plaintext, sections, images, infoboxes, comments or editors. Synchronous library console diagnostics are suppressed only during this opt-in call; errors never contain library messages or source text.

## 标题安全与辅助 AST

A conservative title boundary rejects pipes, square/curly brackets, angle brackets and ASCII control characters (U+0000–001F/U+007F). It applies to the copied page `title` (`INVALID_RECORD`) and final parser-derived link targets, categories and redirect targets (`PARSE_ERROR`), before target normalization. Localized 文件/檔案 prefixes are aliased to File before the existing library image parser runs. Caption links are obtained from the official WikiParser-Node browser AST and included as ordinary internal links; caption text and image filenames are not emitted. When WTF's approximate ordinary-link splitter returns an unsafe candidate, the **whole page's ordinary links** are instead derived from real AST `link` nodes. Thus valid `[[Target|label|tail]]` yields `Target`; invalid `[[Bad[Caption]]` is nonlink markup, not a fabricated edge or a parser failure. Nested valid AST links survive. The output title check remains unchanged for every retained static AST target, category and redirect: unsafe values still fail the **entire record**. Nothing from a failing current record is emitted.

## 部分观察与动态目标

**Explicit partial-result policy:** when an ordinary link's target AST subtree contains a recognized `template` or `arg` node, that target is unresolved and excluded from edges. The record emits `parse_status:"partial_unresolved_target"`; confirmed static links, category observations and redirects remain subject to their existing extraction and safety rules. This classification walks only target `childNodes` (not display labels); it does not guess from brace/pipe strings or treat every non-text child as dynamic. Thus `[[Prefix{{x}}]]` is not trimmed to `Prefix` by the AST path, and `[[Safe|{{label}}]]` remains a static `Safe` edge. Caption AST targets use the same classifier. Counts and unresolved target strings are **not** output fields.

The same partial contract now covers **AST-proven dynamic category membership**, but only after WTF reports an unsafe category candidate. An on-demand pass through the existing sandboxed browser AST matches that candidate to a real `category` node whose **target**, not sortkey, contains `template` or `arg`. Matching strips the adapter's injected zero-width prefix and the AST's Category/分类/分類 namespace prefix (namespace case-insensitive), and permits outer title whitespace only. Dynamic expression spelling, case, underscores and fragments remain exact; no brace stripping, prefix match, template expansion or second parser is used. Each matched dynamic candidate is excluded; **all** safe WTF category observations remain, including repeated/localized aliases before normal output sorting/deduplication. `[[Category:Static|{{x}}]]` stays static; escaped `[[:Category:...]]` stays a link, not membership. An unsafe candidate without its own exact AST proof remains fatal even beside a proven dynamic category. In particular, WTF can truncate a template/argument target at an internal pipe; an unmatched truncated candidate still fails with `PARSE_ERROR`. This approved extension replaces whole-record rejection only for the matched dynamic category targets. Malformed static titles, unmatched unsafe categories, unsafe redirects and parser exceptions are not excused. Downstream must treat `partial_unresolved_target` as conservative incomplete adjacency, not complete recovery.

**Global quality warning:** neither `"ok"` nor `"partial_unresolved_target"` promises graph completeness or full MediaWiki semantics. Templates are never expanded. Classification applies only where the AST paths observe target nodes (image subtrees, whole-page ordinary-link reconciliation for unsafe WTF candidates, or on-demand unsafe-category reconciliation). No unconditional full-page AST pass is added. On the unchanged primary-only path, WTF may omit or flatten a dynamic target and status stays `"ok"`; `[[{{x}}]]` alone therefore need not be marked partial. Image source returned by WTF can already be flattened before caption AST parsing. Missing template-generated edges and other approximation/historical-title uncertainty remain unresolved globally, not silently recovered.

## 可选诊断

The synchronous export optionally accepts a caller-owned `diagnostics` accumulator in addition to `maxBytes`. It increments numeric `ast_reconciliations` (pages using AST ordinary-link reconciliation), `parser_nonlinks` (ambiguous WTF candidate source strings that are not actual AST link nodes), and `unresolved_dynamic_targets` (excluded ordinary/caption dynamic target-node occurrences plus exactly matched dynamic category candidate occurrences, not expanded template nodes or distinct target strings). Keys are added only by the relevant path; preexisting numeric values accumulate. A whole-page ordinary-link reconciliation replaces caption-only counts for that page so those nodes are not counted twice; category occurrences are then added separately. A valid multi-pipe label is a real AST link and does not count as a nonlink. Only aggregate numbers are stored; no body, target expression, label or AST is exposed. No new output or diagnostic keys are added for categories, and the CLI framing is unchanged.

## 失败、隔离与隐私

On failure the CLI emits **no record for that input**, writes only `{"code":"CODE","request_id":N}` to stderr (1-based line ordinal), stops, and exits 1. Codes: `INVALID_OPTIONS`, `INVALID_JSON` (also invalid UTF-8), `LINE_TOO_LARGE`, `INVALID_RECORD`, `INVALID_TEXT`, `INVALID_TEXT_STATE`, `TEXT_TOO_LARGE`, `PARSE_ERROR`, `IO_ERROR`. Success exits 0 with empty stderr. No fallback emits fake empty data. Literal regions (nowiki, pre, source, syntaxhighlight, templatedata) and comments are masked using htmlparser2 XML token offsets **before** redirect/category and ordinary-link parsing. Long quoted attributes, nested literal tags, self-closing tags and unclosed regions through EOF are covered by tests. This is an upstream graph adapter, not a second regex body parser or a claim of comprehensive MediaWiki semantics. WikiParser-Node's Node entry point has an unconditional exception body recorder; it is deliberately never loaded. The official browser bundle executes in a VM with no filesystem, process, require or network capabilities. Only static installed library code is read, and no body or AST is serialized. Parser CPU/RSS isolation, siteinfo-complete namespace mapping and full template expansion remain caller/library concerns.

## 快速示例

```sh
printf '%s\n' '{"page_id":"1","ns":0,"title":"Example","revision_id":"2","timestamp":"2025-01-01T00:00:00Z","text_state":"present","text":"[[Earth]] [[Category:Examples]]"}' | node bin/graph.js
```

```js
const { extractGraph } = require('./src/graph')
const result = extractGraph({
  page_id: '1', ns: 0, title: 'Example', revision_id: '2',
  timestamp: '2025-01-01T00:00:00Z', text_state: 'present',
  text: '[[Earth]] [[Category:Examples]]'
})
```

历史根路径 `node graph-cli.js` 与 `require('./graph')` 只作兼容转发，新集成使用上述规范路径。

## 三种状态的消费方式

| parse_status | 含义 | 消费者须知 |
|---|---|---|
| `ok` | 当前直接观察路径完成 | 不保证模板展开或完整 MediaWiki 语义 |
| `partial_unresolved_target` | AST 明确识别了尚未求值的目标 | 保留静态观察，但不能把观察出度当完整出度 |
| `unavailable` | 正文 hidden/missing | 没有可据以推断的边，不等同已知零边页面 |

严格无正文留存的调用必须选择此 graph 路径，不要通过 HTTP/gRPC 的旧 worker 绕行。调用者仍须负责进程资源隔离、全部阶段退出码、EOF、来源完整性及最终产物发布。特定历史数据集的跑批状态不属于本仓库协议保证。
