const express = require('express')
const wtf = require('wtf_wikipedia')
const bodyParser = require('body-parser');

const app = express()
const port = 13090;

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' })); // Set limit to 10 MB
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// 定义一个 POST 接口
app.post('/api/wikitext', (req, res) => {
    const data = req.body; // 获取请求体中的数据

    // 返回响应
    res.status(201).json({
        text: wtf(data.wikitext).text()
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
});