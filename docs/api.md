# HTTP / gRPC 接口

[项目首页](../readme.md) · [Graph-only 协议](graph-jsonl.md)

两种服务均使用原有页面解析路径，**不是 graph-only JSONL 的网络封装**。本次目录整理不改变请求、状态码、响应格式或解析语义。

## HTTP

```sh
npm run http -- --host 127.0.0.1 --port 13090
# 等价的直接入口：node src/http/server.js
```

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--host` | `0.0.0.0` | 监听地址；本地使用可显式设为 `127.0.0.1` |
| `--port` | `13090` | HTTP 端口 |

### 健康检查

`GET /ping` 返回 **201**（保留现有行为）：

```json
{"message":"pong"}
```

### 解析纯文本

`POST /api/wikitext`，请求体为 JSON：

```json
{"wikitext":"Hello [[World]]"}
```

成功返回 **201**：

```json
{"text":"Hello World"}
```

这里的 `text` 是纯文本字符串，不是 gRPC 的结构化 JSON 字符串。JSON 空对象 `{}`（缺省 `wikitext` 字段）沿用现有空文本行为；不承诺无请求体或格式错误的请求均返回201。本次不重新定义校验或错误状态。Express/body-parser 配置的请求体上限为 `50mb`，不是 graph CLI 的 16 MiB 行上限。

可直接导入 `require('../src/http/server')` 获得 Express app；导入本身不开始监听。

## gRPC

```sh
npm run grpc -- --host 127.0.0.1 --port 30051 --worker full
npm run grpc:tiny -- --host 127.0.0.1 --port 30051
```

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--host` | `0.0.0.0` | 监听地址 |
| `--port` | `30051` | gRPC 端口 |
| `--worker` | `full` | `full` 或 `tiny`，由 Piscina 执行 |

协议文件：[`wikiTextParser.proto`](../protos/wikiTextParser.proto)。

```protobuf
package wikiTextParser;

message WikiText { string text = 1; }
message JsonText { string text = 1; }
service WikiTextParserService {
  rpc GetWikiTextParse (WikiText) returns (JsonText);
}
```

- 请求 `text`：维基文本；服务保留原有 `he.decode` 处理。
- 响应 `text`：**JSON 字符串**，客户端需再执行 `JSON.parse(response.text)`。
- `full`：图片、章节、坐标、infobox、分类、纯文本及分组链接；空字段按原规则移除。
- `tiny`：分类及分组链接，禁用 full 的其他抽取项；不承诺未经测量的性能倍数。
- 空字符串或超过当前 `MAX_TEXT_LENGTH` 的输入返回 `INVALID_ARGUMENT`；worker 失败返回 `INTERNAL`。

当前代码的 `MAX_TEXT_LENGTH` 是 **1,000,000,000 个 JavaScript 字符串 code unit**，不是原 README 所写的 10 MB，也不是可用负载承诺。gRPC/代理自身消息限制、内存和CPU可能更早成为约束；本次只校正文档，不修改限额或放大网络消息配置。

服务每60秒打印调用次数；SIGTERM/SIGINT 进入现有 gRPC/Piscina 关闭流程。连接使用现有不加密凭据，若要对外提供服务，应由部署方另行配置认证、TLS、入口和资源隔离，本仓库不自动完成这些操作。

### 示例客户端

```sh
npm run grpcTest -- --host 127.0.0.1 --port 30051
```

它读取已有 `data/wikitext_1.txt` 与 `data/wikitext_2.txt`，仅作为用法演示。HTTP 请求模板位于 [`examples/http.http`](../examples/http.http)。

## 错误与正文留存边界

服务路径在解析异常时可调用 `src/shared/crash-case.js`，把完整失败输入写入忽略的 `data/crash-cases/`；gRPC 还保留错误栈及前500字符输入片段的日志。`5 MiB` 是 crash-case 写入大小门，不是服务请求上限。

因此，HTTP/gRPC **不提供无正文留存保证**。对严格禁止正文落盘的任务，使用独立的 [graph-only 路径](graph-jsonl.md)。本次整理既不扩大 crash 记录范围，也不将 graph 输入接入该机制。
