const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Target server
const targetApp = express();
targetApp.get('*', (req, res) => {
    console.log('TARGET Received:', req.method, req.url);
    res.send('GOT: ' + req.url);
});
targetApp.listen(3008, () => console.log('Target on 3008'));

// Gateway server
const app = express();

app.use('/api/plants', createProxyMiddleware({
    target: 'http://localhost:3008',
    changeOrigin: true,
    pathRewrite: (path, req) => {
        const result = req.baseUrl + req.path;
        console.log('REWRITE:', { pathFromHPM: path, baseUrl: req.baseUrl, reqPath: req.path, originalUrl: req.originalUrl, result });
        return result;
    }
}));

app.listen(3009, () => {
    console.log('Gateway on 3009');

    // Test it locally after giving servers 1 second to start
    setTimeout(() => {
        fetch('http://localhost:3009/api/plants')
            .then(res => res.text())
            .then(text => {
                console.log('Response for /api/plants:', text);
                return fetch('http://localhost:3009/api/plants/123');
            })
            .then(res => res.text())
            .then(text => {
                console.log('Response for /api/plants/123:', text);
                process.exit(0);
            });
    }, 1000);
});
