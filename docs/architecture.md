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
