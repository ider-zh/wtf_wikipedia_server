
var PROTO_PATH = __dirname + '/protos/wikiTextParser.proto';
const fs = require('fs');
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


const args = process.argv.slice(2); // 移除前两个元素（node 和 script路径）
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 50051;
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '0.0.0.0';
function main() {

    const address = `${host}:${port}`;

    var client = new wikiTextParser_proto.WikiTextParserService(address, grpc.credentials.createInsecure());
    for (let text of [historyText1, historyText2]) {

        client.GetWikiTextParse({ text }, function (err, response) {
            console.log('Greeting:', JSON.parse(response.text), err);
            console.table(response.text)
        });
    }

}

main();