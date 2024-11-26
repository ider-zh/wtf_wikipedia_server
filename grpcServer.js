const path = require('path');
var PROTO_PATH = __dirname + '/protos/wikiTextParser.proto';

var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');

const Piscina = require('piscina');
const piscina = new Piscina({
    filename: path.resolve(__dirname, 'worker_tiny.js')
});

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

// 定义调用次数计数器
let callCount = 0;
// 定时打印日志的函数
const logInterval = setInterval(() => {
    const now = new Date();
    const timestamp = now.toLocaleString(); // Format the date and time as a string
    console.log(`${timestamp}: GetWikiTextParse has been called ${callCount} times.`);
}, 60000); // 每分钟打印一次日志

async function GetWikiTextParse(call, callback) {
    callCount++; // 增加调用次数
    let wikiText = call.request.text
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')

    try {
        const data = await piscina.run(wikiText);
        callback(null, { text: JSON.stringify(data) });
    } catch (error) {
        console.error('An error occurred:', error);
        callback(null, { text: JSON.stringify({}) });
    }


}


const args = process.argv.slice(2); // 移除前两个元素（node 和 script路径）
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 50051;
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '0.0.0.0';
/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
    const address = `${host}:${port}`;

    var server = new grpc.Server();
    server.addService(wikiTextParser_proto.WikiTextParserService.service, { GetWikiTextParse: GetWikiTextParse });
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error('Failed to bind server:', err);
            return;
        }
        console.log(`Server bound to ${address}`);
        logInterval
    });
}

main();