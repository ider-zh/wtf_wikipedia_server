# WTF Wikipedia Server 项目文档

## 项目概述

这是一个基于 wtf_wikipedia 库的维基文本解析服务器，提供两种服务接口：
- HTTP REST API (Express)
- gRPC 服务

项目使用 Node.js 构建，主要功能是解析维基文本格式并返回结构化的 JSON 数据。

## 主要技术栈

- **Node.js** - 运行时环境
- **Express** - HTTP 服务器框架
- **gRPC** - 远程过程调用框架
- **wtf_wikipedia** - 维基文本解析库
- **Piscina** - 工作线程池管理
- **lodash** - 实用工具库

## 项目结构

```
wtf_wikipedia_server/
├── data/              # 测试数据文件
├── protos/            # gRPC 协议定义文件
├── expressServer.js   # Express HTTP 服务器
├── grpcServer.js      # gRPC 服务器
├── grpcClient.js      # gRPC 客户端测试
├── worker_full.js     # 完整解析工作线程
├── worker_tiny.js     # 精简解析工作线程
├── makefile          # PM2 进程管理命令
└── package.json      # 项目配置和依赖
```

## 构建和运行

### 安装依赖
```bash
npm install
```

### 启动 HTTP 服务器
```bash
# 默认端口 13090
npm run http

# 指定端口
npm run http -- --port 8080 --host 0.0.0.0
```

### 启动 gRPC 服务器
```bash
# 默认端口 30051
npm run grpc

# 指定端口
npm run grpc -- --port 30052 --host 0.0.0.0
```

### 使用 PM2 进程管理
```bash
# 启动服务
make start

# 停止服务
make stop

# 删除进程
make delete

# 查看进程列表
make list

# 监控进程
make monit
```

### 测试 gRPC 客户端
```bash
npm run grpcTest
```

## API 接口

### HTTP API

#### 健康检查
```http
GET /ping
```

#### 维基文本解析
```http
POST /api/wikitext
Content-Type: application/json

{
    "wikitext": "[[Greater_Boston|Boston]]s [[Fenway_Park|baseball field]] has a {{convert|37|ft}} wall."
}
```

### gRPC API

#### 服务定义
```protobuf
service WikiTextParserService {
    rpc GetWikiTextParse (WikiText) returns (JsonText);
}
```

#### 请求消息
```protobuf
message WikiText {
  string text = 1;
}
```

#### 响应消息
```protobuf
message JsonText {
    string text = 1;
}
```

## 工作线程类型

### worker_full.js
完整解析模式，提取以下信息：
- 图片 (images)
- 坐标 (coordinates) 
- 信息框 (infoboxes)
- 分类 (categories)
- 链接 (links)
- 纯文本 (plaintext)

### worker_tiny.js
精简解析模式，仅提取：
- 分类 (categories)
- 链接 (links)

## 开发约定

### 代码风格
- 使用 CommonJS 模块系统
- 4 空格缩进
- 使用 yargs 进行命令行参数解析
- 使用 Piscina 进行工作线程池管理

### 错误处理
- gRPC 服务使用标准 gRPC 状态码
- 输入文本最大长度限制为 10MB
- 实现了优雅关停机制

### 性能优化
- 使用工作线程池处理解析任务
- 每分钟打印调用次数统计
- 支持大文件处理 (50MB 限制)

## 配置选项

### gRPC 服务器
- `--port`: 服务器端口 (默认: 30051)
- `--host`: 服务器地址 (默认: 0.0.0.0)

### HTTP 服务器  
- `--port`: 服务器端口 (默认: 13090)
- `--host`: 服务器地址 (默认: 0.0.0.0)