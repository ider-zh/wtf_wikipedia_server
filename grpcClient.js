
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

    for (let i = 0; i < [historyText1, historyText2].length; i++) {
        const text = [historyText1, historyText2][i];

        client.GetWikiTextParse({ text }, function (err, response) {
            if (err) {
                console.error(`错误 ${i + 1}:`, err.message);
                console.error(`错误详情:`, err);
                return;
            }

            if (!response) {
                console.error(`错误 ${i + 1}: 响应为空`);
                return;
            }

            try {
                console.log(`\n=== 测试文本 ${i + 1} 解析结果 ===`);
                const parsedData = JSON.parse(response.text);
                console.log('解析成功:', parsedData);

                // 显示主要信息
                if (parsedData.categories) {
                    console.log('分类:', parsedData.categories);
                }
                if (parsedData.links) {
                    console.log('链接数量:', Object.keys(parsedData.links).length);
                }
                if (parsedData.plaintext) {
                    console.log('纯文本长度:', parsedData.plaintext.length);
                }
            } catch (parseError) {
                console.error(`解析响应 JSON 失败 ${i + 1}:`, parseError.message);
                console.log('原始响应:', response.text);
            }
        });
    }

}

main();