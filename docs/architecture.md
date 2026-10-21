# 架构与目录职责

[项目首页](../readme.md) · [开发指南](development.md) · [路径迁移](migration.md)

## 三条调用路径

```text
HTTP 请求 ──> src/http/server.js ───────────────> wtf_wikipedia ──> 纯文本

gRPC 请求 ──> src/grpc/server.js ──> Piscina
                                      └─> src/workers/{full,tiny}.js
                                           └─> wtf_wikipedia ──> JSON 字符串

stdin JSONL ──> bin/graph.js ──> src/graph/index.js ──> stdout 图元数据
                                    ├─> wtf_wikipedia
                                    ├─> markup.js：literal/comment masking
                                    └─> ast.js：沙箱 browser AST 校正
```

## 进程生命周期与接口取舍

命令行是启动形式，不决定进程寿命。`bin/graph.js` 在进程加载时导入 graph 核心与解析依赖，再在 `main()` 中循环读取 stdin；每条记录调用一次 `extractGraph`，共享同一进程内已加载的模块和辅助 AST 环境。每页仍需独立解析，复用不意味着跨页复用文档对象或保存正文。

```text
启动一个 worker → 加载解析依赖一次
                → 输入记录 → 解析 → 输出记录
                → 输入记录 → 解析 → 输出记录
                → EOF 正常退出 / 致命错误停止
```

| 方式 | 生命周期 | 取舍 |
|---|---|---|
| 每条记录启动一个 CLI | 每页重复初始化 | 容易单条复现，不作为批量调用方式 |
| 长驻 CLI + JSONL 管道 | 一次启动连续处理，离线调用方可按分片管理 | 本地管道、明确退出边界；调用方承担并发、超时、取消与checkpoint |
| 常驻 gRPC streaming 服务 | 服务与worker跨任务复用 | 适合多客户端/跨机器接入；另需连接、流控、任务隔离与服务运维；本项目尚未实现graph流式RPC |

当前选择长驻 CLI 作为离线 graph 批处理入口。stdin按顺序处理，stdout背压会暂停继续消费；这是有界流式处理，不是硬RSS或CPU限制。某条致命错误会终止进程，之前可能已有合法输出；调用方仍须检查所有阶段退出码与完整EOF，不得把前缀当完整结果。合成记录可通过同一CLI复现；真实源正文不得为了调试写入临时文件。

现有 `protos/wikiTextParser.proto` 的 `GetWikiTextParse` 是单次请求/响应，走full/tiny worker，既不是streaming RPC，也不是graph核心的网络入口。未对相同图核心、相同输入和并发配置进行CLI/gRPC streaming基准测试，因此不宣称某种传输必然更快。若新增流式服务，应复用 `src/graph`，保持字段、partial、安全边界及背压契约，并单独测量初始化、稳定吞吐、延迟、峰值内存和故障恢复成本。

## 后端与适配层

- **主解析后端**：`wtf_wikipedia`。确切安装版本由 `package-lock.json` 固定；本项目对其调用、输出及服务方式做适配，不声称修改了后端库源码。
- **服务侧共享逻辑**：`src/shared/sanitize.js` 保留原有 percentage 类模板预处理；`crash-case.js` 保留原有故障样本记录。这些模块不由 graph 路径加载。
- **图适配层**：`src/graph/index.js` 负责元数据校验、链接/分类/重定向观察、排序去重、标题安全边界及部分状态。
- **辅助 AST**：`src/graph/ast.js` 读取已安装 WikiParser-Node 的官方 browser bundle，在没有 filesystem/process/require/network 能力的 VM 中运行；不使用会记录异常正文的 Node 入口。
- **literal masking**：`src/graph/markup.js` 复用 htmlparser2 token offsets 和辅助 AST 范围处理 literal/comment，不另外实现一套 wikitext 解析器。

## 文件放置规则

| 路径 | 职责 |
|---|---|
| `bin/` | 可直接运行的 graph JSONL 命令 |
| `src/http/`、`src/grpc/` | 协议服务及启动逻辑 |
| `src/workers/` | Piscina 页面解析实现 |
| `src/shared/` | 服务路径共享支持代码 |
| `src/graph/` | 独立的 graph-only 实现与内部辅助模块 |
| `examples/` | 示例客户端和本地请求模板，不作为生产依赖 |
| `protos/` | gRPC wire contract；保留原路径 |
| `data/` | 原有示例文本；`crash-cases/` 是忽略的运行时目录 |
| `test/graph/` | graph 提取、CLI、边界、隐私和部分观察测试 |
| `test/services/` | HTTP / gRPC 测试 |
| `test/workers/`、`test/regression/` | worker 与原有样本回归 |
| `docs/` | 使用协议、架构、开发、迁移文档 |

根目录旧 `.js` 名称是兼容层，不再承载业务实现。不新增一套入口实现，不在兼容层复制解析逻辑；新增内部代码放到其对应目录。

## 不改变的语义与限制

本次为目录、入口路由与文档重构；HTTP/gRPC响应、worker解析、graph字段及partial策略不随迁移改变。依赖范围和锁定版本不因整理而升级。

图模式仍是直接wikitext观察，不展开模板，不恢复历史标题，也不保证完整MediaWiki语义；`ok`不是全图完整性承诺。`partial_unresolved_target`必须作为部分观察消费。所有协议细节集中在[graph契约](graph-jsonl.md)，不把特定dump试跑过程堆进README或变成通用保证。
