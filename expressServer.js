'use strict'
const app = require('./src/http/server')
if (require.main === module) app.main()
module.exports = app
