// gateway/src/index.js
require('dotenv').config({ path: '../.env' });
process.env.SERVICE_NAME = 'gateway';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const logger = require('./shared/logger');

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.GATEWAY_PORT || 3000;

// ── Security ──
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser());

// ── Global rate limit ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  message: { success: false, message: 'Too many requests' },
}));

// ── Request logger ──
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ gateway: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── Service definitions ──
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  plantConfig: process.env.PLANT_CONFIG_SERVICE_URL || 'http://localhost:3002',
  dataEntry: process.env.DATA_ENTRY_SERVICE_URL || 'http://localhost:3003',
  dgrCompute: process.env.DGR_COMPUTE_SERVICE_URL || 'http://localhost:3004',
  reportExport: process.env.REPORT_EXPORT_SERVICE_URL || 'http://localhost:3005',
};

const proxyOpts = (target) => ({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      logger.error('Proxy error', { target, path: req.path, message: err.message });
      res.status(502).json({ success: false, message: 'Service temporarily unavailable' });
    },
  },
});

// ── Route → Service mapping ──
app.use('/api/auth', createProxyMiddleware(proxyOpts(services.auth)));
app.use('/api/plants', createProxyMiddleware(proxyOpts(services.plantConfig)));
app.use('/api/config', createProxyMiddleware(proxyOpts(services.plantConfig)));
app.use('/api/data-entry', createProxyMiddleware(proxyOpts(services.dataEntry)));
app.use('/api/dgr', createProxyMiddleware(proxyOpts(services.dgrCompute)));
app.use('/api/reports', createProxyMiddleware(proxyOpts(services.reportExport)));

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Service routing:', services);
});

module.exports = app;
