// services/data-entry/src/index.js
require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'data-entry';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const logger = require('./shared/logger');
const { error } = require('./shared/response');

const powerRoutes = require('./routes/power.routes');
const fuelRoutes = require('./routes/fuel.routes');
const waterRoutes = require('./routes/water.routes');
const perfRoutes = require('./routes/performance.routes');
const ashRoutes = require('./routes/ash.routes');
const dsmRoutes = require('./routes/dsm.routes');
const scadaRoutes = require('./routes/scada.routes');
const schedRoutes = require('./routes/scheduling.routes');
const availRoutes = require('./routes/availability.routes');
const opsRoutes = require('./routes/operations.routes');
const submissionRoutes = require('./routes/submission.routes');
const taqaRoutes = require('./routes/taqa.routes');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || process.env.DATA_ENTRY_SERVICE_PORT || 3003;

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); cb(new Error('CORS')); },
  credentials: true,
}));
app.use(express.json({ limit: '50kb' }));

app.get('/health', (req, res) => {
  res.json({ service: 'data-entry', status: 'ok', uptime: process.uptime() });
});

app.use('/api/data-entry/power', powerRoutes);
app.use('/api/data-entry/fuel', fuelRoutes);
app.use('/api/data-entry/water', waterRoutes);
app.use('/api/data-entry/performance', perfRoutes);
app.use('/api/data-entry/ash', ashRoutes);
app.use('/api/data-entry/dsm', dsmRoutes);
app.use('/api/data-entry/scada', scadaRoutes);
app.use('/api/data-entry/scheduling', schedRoutes);
app.use('/api/data-entry/availability', availRoutes);
app.use('/api/data-entry/operations', opsRoutes);
app.use('/api/data-entry/submission', submissionRoutes);
app.use('/api/data-entry/taqa', taqaRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, err.isOperational ? err.message : 'Internal server error', err.statusCode || 500);
});

app.listen(PORT, () => logger.info(`Data Entry Service running on port ${PORT}`));
module.exports = app;
