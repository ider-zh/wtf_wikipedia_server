# 开发、测试与运行管理

[项目首页](../readme.md) · [架构](architecture.md) · [迁移说明](migration.md)

## 环境

锁定依赖对 Node.js 版本有各自的引擎要求，开发使用 Node.js 24.11+ 或满足全部依赖约束的较新版本。查看项目清单与锁文件，不凭后端库的最低版本推断整个服务的要求。

```sh
npm ci --ignore-scripts
npm test -- --runInBand
```

测试脚本显式通过 Node 执行已安装的 Jest，避免 noexec 数据盘上的 `.bin/jest` 启动问题。若 npm 的远端来源策略阻止锁文件内的 tarball URL，先检查锁文件及本机策略；不要无条件放开所有远端源。带原生 `.node` 二进制的依赖还需要可执行的缓存/安装位置；不要把生产正文拷到可执行目录来绕过限制。

## 测试分组

```sh
npm test -- --runInBand test/graph
npm test -- --runInBand test/services
npm test -- --runInBand test/workers test/regression
```

- graph测试覆盖精确字段、lossless ID、状态、静态/动态目标、安全标题、CLI前缀/继续与stderr、大小限制和隐私。
- HTTP使用supertest验证现有app契约；gRPC测试会在本机启动服务与worker并关闭，运行时确保其测试端口未被占用。
- worker及样本回归保留原有full/tiny行为；现有样本目录不作为新真实正文的存储授权。
- 结构兼容测试应验证规范路径与旧入口的转发，而非再复制一份实现。

改动行为时先写并运行失败回归，再实现并执行全套。纯目录移动仍需验证相对导入、Piscina worker路径、proto/样本路径、mock绑定目标和任意工作目录下的启动。文档内命令、链接和示例也需实际检查。

## 入口与兼容

新代码使用 `src/`，graph批处理使用 `bin/graph.js`。根目录旧脚本只用于已有集成过渡，不再添加新逻辑；npm脚本指向规范实现。具体映射见[迁移说明](migration.md)。

## PM2 / Makefile

PM2为可选外部工具，不随依赖自动安装。以下命令在本机执行，不是本次重构自动部署动作：

```sh
make start          # full：进程名 wtf_wikipedia
make start-tiny     # tiny：进程名 wtf_wikipedia_tiny
make list
make monit
make stop
make delete
make restart
make restart-tiny
```

full和tiny模板默认使用相同30051端口，不能同时启动；并行部署时需显式使用不同端口。`make stop/delete`只针对上述命名进程；运行前确认它们属于当前部署。

## 提交边界

- 不提交 `node_modules/`、`.pm2/`、`data/crash-cases/`、凭据、私有路径或真实流水线中间产物。
- 保持graph路径不加载服务crash recorder。无正文契约不自动延伸到旧服务路径。
- 不在README堆积某次数据集试跑、故障排查和审批进度；这些留在调用方项目，README只提供选择入口与导航。
- 目录/入口重构使运行文件hash发生变化。绑定源码路径或revision的外部流水线必须创建新版本recipe与产物generation；不要重写已有checkpoint、manifest或历史验证证据。
