// services/report-export/src/index.js
require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'report-export';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const logger    = require('./shared/logger');
const { error } = require('./shared/response');
const ctrl      = require('./controllers/export.controller');
const { authenticate, requirePlantAccess } = require('./middleware/auth.middleware');

const app  = express();
const PORT = process.env.REPORT_EXPORT_SERVICE_PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'report-export', status: 'ok' }));

// ── Excel DGR ──
app.get('/api/reports/dgr/excel/:plantId/:date',
  authenticate, requirePlantAccess, ctrl.exportDGRExcel);

// ── SAP Export ──
app.get('/api/reports/sap/:plantId/:date',
  authenticate, requirePlantAccess, ctrl.exportSAP);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, 'Internal server error', 500);
});

app.listen(PORT, () => logger.info(`Report Export Service running on port ${PORT}`));
module.exports = app;
