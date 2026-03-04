const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Target server
const targetApp = express();
targetApp.get('*', (req, res) => {
    res.send('TARGET GOT: ' + req.url);
});
targetApp.listen(3031, () => console.log('Target on 3031'));

// Gateway server
const app = express();

app.use('/api/plants', createProxyMiddleware({
    target: 'http://localhost:3031',
    changeOrigin: true,
    pathRewrite: (path, req) => {
        return req.baseUrl + req.path;
    }
}));

app.listen(3032, () => {
    setTimeout(() => {
        fetch('http://localhost:3032/api/plants?foo=bar')
            .then(res => res.text())
            .then(text => {
                console.log('baseUrl + path gave => Response:', text);
                process.exit(0);
            });
    }, 1000);
});
