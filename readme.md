# WTF Wikipedia Server

## Opt-in graph-only JSONL (no body retention)

Run `node graph-cli.js` directly; this does **not** start or change the legacy HTTP/gRPC APIs. Install the existing lock with `npm ci --ignore-scripts` (npm 12 may require `--allow-remote=all` for the lock's mirror tarball URLs). No new dependency or lock change is required.

```sh
# XML selection producer emits selected-revision records on stdout only.
selected-revision-command | node /path/to/wtf_wikipedia_server/graph-cli.js > graph.jsonl
# Smaller byte bound (default and hard maximum: 16777216 bytes per JSONL line):
selected-revision-command | node /path/to/wtf_wikipedia_server/graph-cli.js --max-line-bytes 1048576 > graph.jsonl
```

The producer/parent must check **both** process exit codes, consume stderr, and only publish output after successful EOF; a valid prefix can precede a later error. Do not write producer JSONL to a file: it contains transient source bodies. The CLI processes records sequentially, pauses stdin on stdout backpressure, accepts a final non-newline-terminated record, and rejects blank lines, invalid UTF-8/JSON and over-limit lines before parsing them. The bound includes JSON metadata/escaping, not just text, and excludes the terminating LF (a CR in CRLF still counts). `extractGraph`'s `maxBytes` instead bounds decoded UTF-8 text alone. Go's default JSON encoder escapes `<`, `>` and `&` to six-byte `\uXXXX` sequences; quotes, backslashes and control characters can also expand. Consequently the XML selector's decoded-text limit and this CLI's serialized-line limit are **not interchangeable**: a selector-accepted body can fail `LINE_TOO_LARGE`. Account for worst-case escaping (up to six times decoded text bytes), metadata and JSON framing when choosing a lower selector limit; the graph CLI hard cap remains 16 MiB. Do not silently raise it or strip/reencode source text to force admission. This is a bounded input queue, not a hard RSS or parser CPU-time bound.

Input: `{page_id, ns, title, revision_id, timestamp, text_state, text?, redirect_target?}`. IDs must be exact decimal strings or safe nonnegative JS integers (large IDs **must** be strings). Metadata is copied without lowercasing. `text_state` is `present` (any string, including the XML selector's present-empty `""`), `empty` (legacy explicit empty-string alias), `hidden` or `missing` (absent/null/empty text). Hidden/missing records emit `parse_status:"unavailable"`, no edges and null redirect; present/empty emit `"ok"`. Present-empty remains `text_state:"present"` with empty adjacency and null redirect; it is not relabeled missing, unavailable or empty. The producer must validate timestamp and namespace/source identity; the graph extractor does not reconstruct historical titles.

Output has **exactly** `{page_id,ns,title,revision_id,timestamp,text_state,links,categories,redirect_target,parse_status}`. `links` is a sorted deduplicated array of `{target,namespace?:integer}` (namespace 14 is reported for recognized Category/分类/分類 prefixes; other namespaces remain unresolved). Categories are sorted unique names **without** namespace prefixes. Fragments are removed; underscores become spaces; case is preserved. Escaped `[[:Category:...]]` is a page link, not membership. Redirects derive **only from selected wikitext**, including English `#REDIRECT`, Chinese `#重定向` and `#重新導向`; incoming export-time `redirect_target` is ignored.

`require('./graph').extractGraph(record, {maxBytes?})` is the independent synchronous export. `maxBytes` must be a finite positive safe integer no greater than 16777216 (default); invalid values fail with `INVALID_OPTIONS` before any text-state shortcut, including hidden/missing/present-empty records. It uses the real locked `wtf_wikipedia` parser, not the legacy workers or crash recorder. Namespace/directive aliases are normalized before the library call. A temporary zero-width prefix works around the library's two-character category minimum and is removed from category results. There is no additional `he.decode`: XML decoding belongs to the XML producer; the library retains its own entity semantics. The graph path does not serialize raw text, display anchors, plaintext, sections, images, infoboxes, comments or editors. Synchronous library console diagnostics are suppressed only during this opt-in call; errors never contain library messages or source text.

A conservative title boundary rejects pipes, square/curly brackets, angle brackets and ASCII control characters (U+0000–001F/U+007F). It applies to the copied page `title` (`INVALID_RECORD`) and all library-derived link targets, categories and redirect targets (`PARSE_ERROR`), before target normalization. For example, the library can misclassify a localized image caption as a link target containing pipes/nested brackets; that fails the **entire record**, not just that edge. Nothing from the current record is emitted, even if valid edges were already collected. This is not full MediaWiki title validation or comprehensive markup/caption detection: apparently valid titles can still be wrong parser interpretations, and the boundary does not reconstruct or reparse them.

On failure the CLI emits **no record for that input**, writes only `{"code":"CODE","request_id":N}` to stderr (1-based line ordinal), stops, and exits 1. Codes: `INVALID_OPTIONS`, `INVALID_JSON` (also invalid UTF-8), `LINE_TOO_LARGE`, `INVALID_RECORD`, `INVALID_TEXT`, `INVALID_TEXT_STATE`, `TEXT_TOO_LARGE`, `UNSUPPORTED_MARKUP`, `PARSE_ERROR`, `IO_ERROR`. Success exits 0 with empty stderr. No fallback emits fake empty data. The locked library has no literal-tag parsing option: its preprocessing strips only nowiki/pre delimiters, leaving their contents eligible as links/categories. Its normal source/syntaxhighlight block removal does work for simple paired tags, but the internal opening-tag pattern caps attributes at 200 characters, and the redirect constructor skips preprocessing entirely before extracting categories. Runtime probes show literal category leakage for redirects with all four tags, and link/category leakage with long source/syntaxhighlight attributes. It also treats link/category syntax inside templatedata JSON descriptions as graph edges. Thus opening tags for **nowiki, pre, source, syntaxhighlight and templatedata** fail closed with `UNSUPPORTED_MARKUP`, **including benign contents**; no record is emitted and processing stops. Safely narrowing that refusal needs a library-level fix with tag-aware parsing, not a second parser, regex stripping or an invented per-record success/unparsed status here. This guard covers known reproduced failures only; it is neither an exhaustive list of literal extensions nor proof of comprehensive wiki parsing. Parser CPU/RSS isolation, siteinfo-complete namespace mapping and full template expansion remain caller/library concerns.

Tests: `node node_modules/jest/bin/jest.js --runInBand`. This explicit Node command works on noexec data mounts where `npm test` cannot execute `.bin/jest`; native `.node` dependency binaries must reside in an executable host cache (not source bodies). Privacy tests use runtime-generated canaries, assert sanitized errors/no file writes/no crash recorder, and execute the real CLI/library. Existing legacy tests remain unchanged.

基于 wtf_wikipedia 库的维基文本解析服务器，提供 HTTP REST API 和 gRPC 两种服务接口。

## 功能特性

- 🚀 双协议支持：HTTP REST API 和 gRPC
- ⚡ 高性能：使用工作线程池处理并发请求
- 📊 监控：内置调用统计和性能监控
- 🔧 灵活配置：支持自定义端口和主机地址
- 🛡️ 安全性：输入验证和错误处理

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

#### HTTP 服务器

```bash
# 默认端口 13090
npm run http

# 自定义端口
npm run http -- --port 8080 --host 0.0.0.0
```

#### gRPC 服务器

```bash
# 完整模式（默认）
npm run grpc

# 精简模式（高性能）
npm run grpc:tiny

# 自定义端口和模式
npm run grpc -- --port 30052 --worker tiny

# 使用 PM2 进程管理
pm2 start npm -- run grpc -- --port 30051 --worker full
```

### 进程管理

```bash
# 查看进程列表
pm2 list

# 监控进程状态
pm2 monit

# 停止进程
pm2 stop wtf_wikipedia

# 删除进程
pm2 delete wtf_wikipedia
```

或使用 Makefile：

```bash
make start       # 启动完整模式服务
make start-tiny  # 启动精简模式服务
make stop        # 停止所有服务
make delete      # 删除所有进程
make list        # 查看进程
make monit       # 监控进程
make restart     # 重启完整模式服务
make restart-tiny # 重启精简模式服务
```

## API 使用示例

### HTTP API

#### 健康检查

```bash
curl http://localhost:13090/ping
```

#### 维基文本解析

```bash
curl -X POST http://localhost:13090/api/wikitext \
     -H "Content-Type: application/json" \
     -d '{"wikitext": "[[Greater_Boston|Boston]]s [[Fenway_Park|baseball field]] has a {{convert|37|ft}} wall. <ref>Field of our Fathers: By Richard Johnson</ref>"}'
```

### gRPC API

```bash
# 测试 gRPC 客户端
npm run grpcTest
```

## 响应示例

```json
{
  "text": "{\"categories\":[\"Baseball\",\"Boston\"],\"links\":[{\"text\":\"Boston\",\"page\":\"Greater_Boston\"},{\"text\":\"baseball field\",\"page\":\"Fenway_Park\"}],\"plaintext\":\"Bostons baseball field has a 37 ft wall.\"}"
}
```

## 配置选项

- **端口**: 通过 `--port` 参数指定
- **主机**: 通过 `--host` 参数指定 (默认: 0.0.0.0)
- **Worker 模式**: 通过 `--worker` 参数指定 (full/tiny)
- **最大文本长度**: 10MB
- **请求限制**: 50MB (HTTP)

## 工作模式

项目提供两种解析模式：

### 完整模式 (full)
- **Worker**: `worker_full.js`
- **功能**: 提取所有信息（图片、坐标、信息框、分类、链接、纯文本）
- **适用场景**: 需要完整维基页面信息的应用、数据分析、内容管理
- **性能**: 较慢，内存占用较高

### 精简模式 (tiny)
- **Worker**: `worker_tiny.js`
- **功能**: 仅提取分类和链接信息
- **适用场景**: 高频调用、链接分析、分类统计、高并发API服务
- **性能**: 更快，内存占用较低

### 使用示例

```bash
# 启动完整模式
npm run grpc:full
# 或
make start

# 启动精简模式
npm run grpc:tiny
# 或
make start-tiny

# 自定义参数
node grpcServer.js --port 30052 --worker tiny --host 127.0.0.1
```

## 监控

gRPC 服务器每分钟会打印调用次数统计：

```
2023-11-26 10:30:00: GetWikiTextParse has been called 15 times.
```

## 技术栈

- Node.js
- Express (HTTP 服务器)
- gRPC (远程过程调用)
- wtf_wikipedia (维基文本解析)
- Piscina (工作线程池)
- lodash (工具库)
