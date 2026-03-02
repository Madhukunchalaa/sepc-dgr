require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'plant-config';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const Joi       = require('joi');
const { query, transaction } = require('./shared/db');
const { success, created, error, notFound, validationError } = require('./shared/response');
const { authenticate, authorize } = require('./middleware/auth.middleware');
const logger    = require('./shared/logger');

const app  = express();
const PORT = process.env.PLANT_CONFIG_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'plant-config', status: 'ok', uptime: process.uptime() }));

// GET /api/plants
app.get('/api/plants', authenticate, async (req, res) => {
  try {
    let plants;
    if (['hq_management','it_admin'].includes(req.user.role)) {
      const { rows } = await query(`SELECT * FROM plants WHERE status='active' ORDER BY name`);
      plants = rows;
    } else {
      const { rows } = await query(
        `SELECT p.* FROM plants p
         JOIN user_plants up ON p.id = up.plant_id
         WHERE up.user_id = $1 AND p.status = 'active' ORDER BY p.name`,
        [req.user.sub]
      );
      plants = rows;
    }
    return success(res, { plants });
  } catch (err) {
    logger.error('Get plants error', { message: err.message });
    return error(res, 'Failed to fetch plants', 500);
  }
});

// GET /api/plants/:id
app.get('/api/plants/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM plants WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return notFound(res, 'Plant');
    const [config, meters, fuels] = await Promise.all([
      query(`SELECT config_key, config_val, data_type, description FROM plant_config WHERE plant_id=$1`, [req.params.id]),
      query(`SELECT * FROM meter_points WHERE plant_id=$1 AND is_active=TRUE ORDER BY sort_order`, [req.params.id]),
      query(`SELECT fuel_type, is_active FROM plant_fuels WHERE plant_id=$1 ORDER BY fuel_type`, [req.params.id]),
    ]);
    return success(res, {
      plant:  rows[0],
      config: config.rows.reduce((acc, r) => ({ ...acc, [r.config_key]: r.config_val }), {}),
      meters: meters.rows,
      fuels:  fuels.rows,
    });
  } catch (err) {
    logger.error('Get plant error', { message: err.message });
    return error(res, 'Failed to fetch plant', 500);
  }
});

// POST /api/plants
app.post('/api/plants', authenticate, authorize('it_admin'), async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(), shortName: Joi.string().required(),
    location: Joi.string().allow(''), companyName: Joi.string().required(),
    documentNumber: Joi.string().allow(''),
    capacityMW: Joi.number().positive().required(),
    plfBaseMW:  Joi.number().positive().required(),
    fyStartMonth: Joi.number().min(1).max(12).default(4),
    fuels:  Joi.array().items(Joi.string()).default(['coal']),
    meters: Joi.array().default([]),
  });
  const { error: err, value } = schema.validate(req.body);
  if (err) return validationError(res, err.details.map(d => d.message));

  try {
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO plants (name, short_name, location, company_name, document_number, capacity_mw, plf_base_mw, fy_start_month)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [value.name, value.shortName, value.location || null, value.companyName,
         value.documentNumber || null, value.capacityMW, value.plfBaseMW, value.fyStartMonth]
      );
      const plant = rows[0];
      for (const fuel of value.fuels) {
        await client.query(`INSERT INTO plant_fuels (plant_id, fuel_type) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [plant.id, fuel]);
      }
      for (const m of value.meters) {
        await client.query(
          `INSERT INTO meter_points (plant_id, meter_code, meter_name, multiplier, meter_type, uom, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [plant.id, m.meterCode, m.meterName, m.multiplier, m.meterType, m.uom || 'MU', m.sortOrder || 0]
        );
      }
      return plant;
    });
    return created(res, result, 'Plant created successfully');
  } catch (err) {
    logger.error('Create plant error', { message: err.message });
    return error(res, 'Failed to create plant', 500);
  }
});

// GET /api/plants/:id/meters
app.get('/api/plants/:id/meters', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM meter_points WHERE plant_id=$1 ORDER BY sort_order`, [req.params.id]
    );
    return success(res, { meters: rows });
  } catch (err) {
    return error(res, 'Failed to fetch meters', 500);
  }
});

// GET /api/plants/:id/submission-status?date=
app.get('/api/plants/:id/submission-status', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await query(
      `SELECT ss.*, u1.full_name AS submitted_by_name, u2.full_name AS approved_by_name
       FROM submission_status ss
       LEFT JOIN users u1 ON ss.submitted_by = u1.id
       LEFT JOIN users u2 ON ss.approved_by = u2.id
       WHERE ss.plant_id=$1 AND ss.entry_date=$2 ORDER BY ss.module`,
      [req.params.id, date]
    );
    const modules = ['power','fuel','performance','water','availability','scheduling','operations'];
    const map = rows.reduce((a, r) => ({ ...a, [r.module]: r }), {});
    const full = modules.map(m => map[m] || { module: m, status: 'not_started' });
    return success(res, { date, modules: full });
  } catch (err) {
    return error(res, 'Failed to fetch status', 500);
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, 'Internal server error', 500);
});

app.listen(PORT, () => logger.info(`Plant Config Service running on port ${PORT}`));
module.exports = app;
