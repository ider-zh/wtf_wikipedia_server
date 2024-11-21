const express = require('express')
const wtf = require('wtf_wikipedia')
const bodyParser = require('body-parser');

const args = process.argv.slice(2); // 移除前两个元素（node 和 script路径）
const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1], 10) : 13090;
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '0.0.0.0';

const app = express()

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' })); // Set limit to 10 MB
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// 定义一个 POST 接口
app.get('/ping', (req, res) => {
    // 返回响应
    res.status(201).json({
        message: 'pong'
    });
});

// 定义一个 POST 接口
app.post('/api/wikitext', (req, res) => {
    const data = req.body; // 获取请求体中的数据

    // 返回响应
    res.status(201).json({
        text: wtf(data.wikitext).text()
    });
});

app.listen(port, host, () => {
    console.log(`Server is running at http://${host}:${port}`);
});