start:
	pm2 start --name "wtf_wikipedia" npm -- run grpc -- --port 30051 
stop:
	pm2 stop "wtf_wikipedia"
delete:
	pm2 delete "wtf_wikipedia"
list:
	pm2 list
monit:
	pm2 monit
