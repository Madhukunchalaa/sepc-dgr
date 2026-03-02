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
const scadaRoutes = require('./routes/scada.routes');
const schedRoutes = require('./routes/scheduling.routes');
const availRoutes = require('./routes/availability.routes');
const opsRoutes = require('./routes/operations.routes');
const submissionRoutes = require('./routes/submission.routes');

const app = express();
const PORT = process.env.DATA_ENTRY_SERVICE_PORT || 3003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '50kb' }));

app.get('/health', (req, res) => {
  res.json({ service: 'data-entry', status: 'ok', uptime: process.uptime() });
});

app.use('/api/data-entry/power', powerRoutes);
app.use('/api/data-entry/fuel', fuelRoutes);
app.use('/api/data-entry/water', waterRoutes);
app.use('/api/data-entry/scada', scadaRoutes);
app.use('/api/data-entry/scheduling', schedRoutes);
app.use('/api/data-entry/availability', availRoutes);
app.use('/api/data-entry/operations', opsRoutes);
app.use('/api/data-entry/submissions', submissionRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, err.isOperational ? err.message : 'Internal server error', err.statusCode || 500);
});

app.listen(PORT, () => logger.info(`Data Entry Service running on port ${PORT}`));
module.exports = app;
