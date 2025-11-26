# 启动完整模式服务
start:
	pm2 start --name "wtf_wikipedia" npm -- run grpc -- --port 30051 --worker full

# 启动精简模式服务（高性能）
start-tiny:
	pm2 start --name "wtf_wikipedia_tiny" npm -- run grpc -- --port 30051 --worker tiny

# 停止所有服务
stop:
	pm2 stop "wtf_wikipedia" || true
	pm2 stop "wtf_wikipedia_tiny" || true

# 删除所有进程
delete:
	pm2 delete "wtf_wikipedia" || true
	pm2 delete "wtf_wikipedia_tiny" || true

# 查看进程列表
list:
	pm2 list

# 监控进程状态
monit:
	pm2 monit

# 重启完整模式服务
restart:
	pm2 restart "wtf_wikipedia"

# 重启精简模式服务
restart-tiny:
	pm2 restart "wtf_wikipedia_tiny"
