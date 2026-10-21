'use strict'
const server = require('./src/grpc/server')
if (require.main === module) server.main()
module.exports = server
