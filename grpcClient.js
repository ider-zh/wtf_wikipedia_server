
var PROTO_PATH = __dirname + '/protos/wikiTextParser.proto';
const fs = require('fs');


const yargs = require('yargs/yargs'); // 使用 yargs 解析参数
const { hideBin } = require('yargs/helpers');

// --- 初始化 ---
const argv = yargs(hideBin(process.argv)).options({
    port: { type: 'number', default: 30051 },
    host: { type: 'string', default: '0.0.0.0' },
}).argv;

var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
var wikiTextParser_proto = grpc.loadPackageDefinition(packageDefinition).wikiTextParser;

const historyText1 = fs.readFileSync(__dirname + '/data/wikitext_1.txt', 'utf8');

const historyText2 = fs.readFileSync(__dirname + '/data/wikitext_2.txt', 'utf8');


function main() {

    const address = `${argv.host}:${argv.port}`;

    var client = new wikiTextParser_proto.WikiTextParserService(address, grpc.credentials.createInsecure());
    for (let text of [historyText1, historyText2]) {

        client.GetWikiTextParse({ text }, function (err, response) {
            console.log('Greeting:', JSON.parse(response.text), err);
            console.table(response.text)
        });
    }

}

main();