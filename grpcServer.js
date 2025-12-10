const path = require('path');
const he = require('he');
var grpc = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');

const yargs = require('yargs/yargs'); // 使用 yargs 解析参数
const { hideBin } = require('yargs/helpers');

// --- 初始化 ---
const argv = yargs(hideBin(process.argv)).options({
    port: { type: 'number', default: 30051 },
    host: { type: 'string', default: '0.0.0.0' },
    worker: {
        type: 'string',
        default: 'full',
        choices: ['full', 'tiny'],
        description: '选择使用哪个 worker: full (完整模式) 或 tiny (精简模式)'
    },
}).argv;

const Piscina = require('piscina');
const workerFile = argv.worker === 'tiny' ? 'worker_tiny.js' : 'worker_full.js';
console.log(`使用 ${argv.worker} 模式 worker: ${workerFile}`);

const piscina = new Piscina({
    filename: path.resolve(__dirname, workerFile)
});


var PROTO_PATH = __dirname + '/protos/wikiTextParser.proto';
const MAX_TEXT_LENGTH = 10000000; // 10MB

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

    // 1. 输入验证
    if (!call.request.text || call.request.text.length > MAX_TEXT_LENGTH) {
        return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: `Input text is missing or exceeds max length of ${MAX_TEXT_LENGTH} chars.`
        });
    }

    callCount++; // 增加调用次数
    let wikiText = he.decode(call.request.text || '');
    // let wikiText = call.request.text
    //     .replace(/&apos;/g, "'")
    //     .replace(/&quot;/g, '"')
    //     .replace(/&gt;/g, '>')
    //     .replace(/&lt;/g, '<')
    //     .replace(/&amp;/g, '&')

    try {
        const data = await piscina.run(wikiText);
        callback(null, { text: data });
    } catch (error) {
        console.error('Worker pool error for a request:', error);
        // 将错误返回给客户端
        const grpcError = {
            code: grpc.status.INTERNAL, // 使用标准 gRPC 状态码
            message: `Failed to process wikitext: ${error.message}`
        };
        callback(grpcError, null);
    }
}

var server = new grpc.Server();
/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
    const address = `${argv.host}:${argv.port}`;

    server.addService(wikiTextParser_proto.WikiTextParserService.service, { GetWikiTextParse: GetWikiTextParse });
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            console.error('Failed to bind server:', err);
            return;
        }
        console.log(`Server bound to ${address}`);
    });
}

// --- 添加优雅关停逻辑 ---
const gracefulShutdown = async () => {
    console.log('\nReceived kill signal, shutting down gracefully.');

    // 1. 停止定时器
    clearInterval(logInterval);

    // 2. 停止 gRPC server 接受新请求
    // server.tryShutdown() 会等待现有请求完成后再回调
    await new Promise((resolve) => {
        server.tryShutdown((err) => {
            if (err) {
                console.error('gRPC server shutdown error:', err);
            }
            console.log('gRPC server has been shut down.');
            resolve();
        });
    });

    // 3. 等待 Piscina 完成所有任务并销毁
    try {
        console.log('Draining and destroying worker pool...');
        await piscina.destroy();
        console.log('Worker pool destroyed.');
    } catch (error) {
        console.error('Error destroying piscina pool:', error);
    }

    console.log('Shutdown complete.');
    process.exit(0);
};

// 监听进程退出信号
process.on('SIGTERM', gracefulShutdown); // kill 命令
process.on('SIGINT', gracefulShutdown);  // Ctrl+C


main();