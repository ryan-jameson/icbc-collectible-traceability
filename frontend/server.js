const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置服务器端口
const PORT = 3000;

// 支持的文件MIME类型
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 解析请求URL
    const parsedUrl = url.parse(req.url);
    
    // 获取请求路径，默认为index.html
    let filePath = `.${parsedUrl.pathname}`;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // 获取文件扩展名
    const extname = path.extname(filePath);
    
    // 记录请求日志
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    // 检查文件是否存在
    fs.exists(filePath, (exists) => {
        if (!exists) {
            // 文件不存在，返回404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`<h1>404 Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
            return;
        }
        
        // 如果是目录，尝试加载index.html
        if (fs.statSync(filePath).isDirectory()) {
            filePath += '/index.html';
        }
        
        // 读取文件并发送响应
        fs.readFile(filePath, (error, content) => {
            if (error) {
                // 读取文件出错，返回500
                console.error(`Error reading file: ${error.message}`);
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
                return;
            }
            
            // 设置内容类型
            const contentType = MIME_TYPES[extname] || 'application/octet-stream';
            
            // 发送响应
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        });
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log('=======================================');
    console.log('  工银溯藏 - 区块链藏品溯源系统演示服务器  ');
    console.log('=======================================');
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('请确保已启动后端API服务和区块链网络');
    console.log('按 Ctrl+C 停止服务器');
    console.log('=======================================');
    
    // 提示用户可能需要修改的配置
    console.log('\n注意事项：');
    console.log('1. 默认API配置指向 http://localhost:5000');
    console.log('2. 如果后端服务运行在不同地址，请修改 frontend/config.js 中的 API_BASE_URL');
    console.log('3. 浏览器可能需要禁用安全策略才能正常访问跨域API');
    console.log('4. 推荐使用Chrome浏览器并安装CORS插件进行测试');
});

// 处理服务器错误
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用，请关闭占用该端口的程序或修改服务器端口`);
    } else {
        console.error(`服务器错误: ${error.message}`);
    }
    process.exit(1);
});

// 处理进程终止信号
process.on('SIGINT', () => {
    console.log('\n服务器正在关闭...');
    server.close(() => {
        console.log('服务器已成功关闭');
        process.exit(0);
    });
});