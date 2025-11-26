# WTF Wikipedia Server

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
