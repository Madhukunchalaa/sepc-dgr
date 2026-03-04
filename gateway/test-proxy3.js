const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Target server
const targetApp = express();
targetApp.get('*', (req, res) => {
    res.send('GOT: ' + req.url);
});
targetApp.listen(3020, () => console.log('Target on 3008'));

// Gateway server
const app = express();

app.use('/api/plants', createProxyMiddleware({
    target: 'http://localhost:3020',
    changeOrigin: true,
    pathRewrite: (path, req) => {
        return req.originalUrl;
    }
}));

app.listen(3030, () => {
    setTimeout(() => {
        fetch('http://localhost:3030/api/plants?foo=bar')
            .then(res => res.text())
            .then(text => {
                console.log('originalUrl gave => Response:', text);
                process.exit(0);
            });
    }, 1000);
});
