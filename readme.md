# WTF Wikipedia Server

基于 **wtf_wikipedia** 的 Node.js 维基文本解析服务，同时提供独立的 graph-only JSONL 批处理接口。

本项目负责服务、worker 和图抽取适配层；不维护后端 `wtf_wikipedia` 的源码分叉。图模式另外使用沙箱化的 WikiParser-Node AST 处理部分歧义，不等同于完整 MediaWiki 渲染或模板展开。

## 选择入口

| 需求 | 命令 | 返回内容 |
|---|---|---|
| 通过 HTTP 获取纯文本 | `npm run http` | `{ "text": "…" }` |
| 通过 gRPC 获取结构化页面信息 | `npm run grpc` | `text` 字段内的 JSON 字符串，默认 full worker |
| 通过 gRPC 只获取分类与链接 | `npm run grpc:tiny` | `text` 字段内的精简 JSON 字符串 |
| 从管道批量抽取图元数据 | `node bin/graph.js` | 每行一条 graph JSON；不启动服务 |

**隐私边界：**只有 graph-only 路径提供专门的无正文输出/无正文落盘契约。HTTP/gRPC 保留原有 crash-case 记录机制，失败输入可能写入 `data/crash-cases/`；gRPC 错误还可能打印输入片段。不要把图模式的保证套用到服务模式。

## 为什么批处理使用长驻 CLI

`node bin/graph.js` **每次启动只初始化一次解析器，然后在同一进程内持续处理多条 JSONL 记录**；不是每解析一页就重新启动。离线任务可按分片分配独立进程，利用 stdin/stdout 背压限制在途数据，直到 EOF 或致命错误退出。

这样既能摊薄初始化成本，也便于用合成输入复现故障、按任务隔离资源。并发、超时、取消和 checkpoint 仍由调用方负责；逐页文档解析成本不会因进程复用而消失。

现有 gRPC 是 full/tiny 页解析的单次 RPC，**尚未提供 graph streaming RPC**。两者并非相同解析负载，不能直接比较吞吐，也未做同核心性能基准。未来若需要跨机器或多客户端复用，可增加复用 `src/graph` 的流式适配器，不复制解析策略。详见[进程生命周期与接口取舍](docs/architecture.md#进程生命周期与接口取舍)。

## 快速开始

使用满足锁定依赖引擎要求的 Node.js（建议 Node.js 24.11+），在仓库根目录安装依赖：

```sh
npm ci --ignore-scripts
```

### HTTP

```sh
npm run http -- --host 127.0.0.1 --port 13090
```

```sh
curl http://127.0.0.1:13090/ping
curl -X POST http://127.0.0.1:13090/api/wikitext \
  -H 'Content-Type: application/json' \
  -d '{"wikitext":"Hello [[World]]"}'
```

### gRPC

```sh
npm run grpc -- --host 127.0.0.1 --port 30051
# 或仅分类与链接：npm run grpc:tiny -- --host 127.0.0.1
# 在另一个终端运行示例客户端：
npm run grpcTest -- --host 127.0.0.1 --port 30051
```

协议定义在 [`protos/wikiTextParser.proto`](protos/wikiTextParser.proto)。HTTP 不使用 full/tiny 切换，两种 worker 属于 gRPC。

### Graph-only JSONL

```sh
selected-revision-command | node bin/graph.js > graph.jsonl
```

左侧程序负责输出所选 revision 的输入记录；这里不是一个内置命令。输入含瞬态正文，**不要先保存输入 JSONL**。必须检查管道各阶段退出码，并等完整 EOF 成功后才发布输出。

字段、大小限制、部分观察、错误码和隐私契约见 [Graph-only 协议](docs/graph-jsonl.md)。

## 项目结构

```text
bin/             graph JSONL 命令行入口
src/
  http/          HTTP 服务
  grpc/          gRPC 服务与 worker 调度
  workers/       full / tiny 页面解析
  shared/        服务路径的预处理与 crash-case 记录
  graph/         图抽取、辅助 AST 与 literal masking
protos/          gRPC 协议
examples/        gRPC 客户端与 HTTP 请求示例
data/            已有示例文本；crash-cases 为运行时忽略目录
test/            按 graph / services / workers / regression 分组的测试
docs/            接口、架构、开发与迁移说明
```

根目录保留的 `.js` 文件仅用于兼容旧路径，业务实现位于 `src/`。新增调用请使用 npm scripts、`bin/` 和 `src/`，不要继续往根目录增加实现。完整路径映射见 [迁移说明](docs/migration.md)。

## 开发与文档

```sh
npm test -- --runInBand
```

- [HTTP / gRPC 接口与运行选项](docs/api.md)
- [Graph-only JSONL 协议](docs/graph-jsonl.md)
- [架构、后端与目录边界](docs/architecture.md)
- [开发、测试与进程管理](docs/development.md)
- [旧路径兼容与迁移](docs/migration.md)

测试与目录整理不代表任意历史 dump 已完成重建。模板、历史标题和辅助 AST 的覆盖限制应随图产物保留，不以 `ok` 状态宣称完整恢复。
