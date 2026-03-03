// services/auth/src/index.js
require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'auth';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./shared/logger');
const authRoutes = require('./routes/auth.routes');
const { error } = require('./shared/response');

const app = express();
const PORT = process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001;

// ── Security middleware ──
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting ──
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
}));

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ service: 'auth', status: 'ok', uptime: process.uptime() });
});

// ── Routes ──
app.use('/api/auth', authRoutes);

// ── 404 handler ──
app.use((req, res) => {
  error(res, `Route ${req.method} ${req.path} not found`, 404);
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  const status = err.statusCode || err.status || 500;
  error(res, err.isOperational ? err.message : 'Internal server error', status);
});

app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});

module.exports = app;
