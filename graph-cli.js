'use strict'
const cli = require('./bin/graph')
if (require.main === module) cli.main()
module.exports = cli
