require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'dgr-compute';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const logger    = require('./shared/logger');
const { error, success } = require('./shared/response');
const { query } = require('./shared/db');
const { assembleDGR, assembleFleetSummary } = require('./engines/dgr.engine');
const { authenticate, requirePlantAccess } = require('./middleware/auth.middleware');

const app  = express();
const PORT = process.env.DGR_COMPUTE_SERVICE_PORT || 3004;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'dgr-compute', status: 'ok', uptime: process.uptime() }));

// GET /api/dgr/:plantId/:date — Full DGR for a date
app.get('/api/dgr/:plantId/:date', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const dgr = await assembleDGR(req.params.plantId, req.params.date);
    return success(res, dgr);
  } catch (err) {
    logger.error('DGR compute error', { message: err.message });
    return error(res, 'Failed to compute DGR', 500);
  }
});

// GET /api/dgr/fleet/:date — HQ fleet summary
app.get('/api/dgr/fleet/:date', authenticate, async (req, res) => {
  try {
    if (!['hq_management','it_admin'].includes(req.user.role)) {
      return error(res, 'Fleet view requires HQ Management role', 403);
    }
    const summary = await assembleFleetSummary(req.params.date);
    return success(res, summary);
  } catch (err) {
    logger.error('Fleet summary error', { message: err.message });
    return error(res, 'Failed to compute fleet summary', 500);
  }
});

// GET /api/dgr/:plantId/history?from=&to=
app.get('/api/dgr/:plantId/history', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const { from, to } = req.query;
    const { rows } = await query(
      `SELECT entry_date, generation_mu, avg_load_mw, plf_daily, apc_pct, export_mu
       FROM daily_power
       WHERE plant_id = $1
         AND ($2::date IS NULL OR entry_date >= $2::date)
         AND ($3::date IS NULL OR entry_date <= $3::date)
         AND status IN ('submitted','approved','locked')
       ORDER BY entry_date`,
      [req.params.plantId, from || null, to || null]
    );
    return success(res, { history: rows });
  } catch (err) {
    return error(res, 'Failed to fetch history', 500);
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, 'Internal server error', 500);
});

app.listen(PORT, () => logger.info(`DGR Compute Service running on port ${PORT}`));
module.exports = app;
