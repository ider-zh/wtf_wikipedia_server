# 目录迁移与兼容

[项目首页](../readme.md) · [架构](architecture.md)

此次整理以保持行为为前提，拆分服务、worker、共享模块与graph实现。不新增协议，不改请求/响应，不升级解析后端，不把graph模式接入旧worker。

## 推荐命令不变

| 用法 | 命令 |
|---|---|
| HTTP | `npm run http -- --host 127.0.0.1 --port 13090` |
| gRPC full | `npm run grpc` / `npm run grpc:full` |
| gRPC tiny | `npm run grpc:tiny` |
| gRPC示例 | `npm run grpcTest` |
| graph CLI | `node bin/graph.js` 或 `npm run graph` |
| 测试 | `npm test -- --runInBand` |

严格管道请优先 `node bin/graph.js`：它的stdout只有协议数据；使用npm运行时须自行处理npm的启动提示，不要将提示混入JSONL。

## 旧公共路径继续可用

以下根文件仅做转发，保留已有集成；业务实现不留在根目录。

| 旧路径 | 规范路径 |
|---|---|
| `expressServer.js` | `src/http/server.js` |
| `grpcServer.js` | `src/grpc/server.js` |
| `grpcClient.js` | `examples/grpc-client.js` |
| `worker_full.js` | `src/workers/full.js` |
| `worker_tiny.js` | `src/workers/tiny.js` |
| `graph.js` | `src/graph/index.js` |
| `graph-cli.js` | `bin/graph.js` |

例如旧 `node graph-cli.js` 和 `require('./graph').extractGraph` 继续工作；新代码使用规范路径。包的 `main`也指向graph模块，不再指向不存在的`index.js`。服务启动仍显式执行对应命令，不由graph导入触发。

## 内部辅助模块与文档迁移

这些是仓库内部实现位置，不再保留根路径兼容文件；自定义代码若直接引用它们，需要相应修改。

| 原路径 | 新位置 |
|---|---|
| `graph-images.js` | `src/graph/ast.js` |
| `graph-markup.js` | `src/graph/markup.js` |
| `sanitize.js` | `src/shared/sanitize.js` |
| `crashCase.js` | `src/shared/crash-case.js` |
| `test.http` | `examples/http.http` |
| `IFLOW.md` | 内容归入`docs/development.md`和`docs/architecture.md`，不再维持第二份完整项目介绍 |
| 平铺的`test/*.test.js` | 按graph/services/workers/regression分组；结构检查仍可位于test根 |

`protos/`、已有`data/`样例与运行时`data/crash-cases/`位置保持不变。目录迁移不能顺便移动、删除或提交现有crash数据。

## 对固定版本流水线的影响

相同输入的协议语义保持，但源码位置、hash和包入口已改变。严格绑定命令/源码/依赖的外部作业不能把新目录直接替换进旧manifest；应更新recipe并创建新generation，重新运行所需验证。此迁移不表示外部Wikipedia历史snapshot已完成。
