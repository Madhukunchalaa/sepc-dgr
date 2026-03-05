// services/data-entry/src/routes/submission.routes.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query } = require('../shared/db');
const { success, error } = require('../shared/response');

// GET /api/data-entry/submission/:plantId?date=YYYY-MM-DD
router.get('/:plantId', authenticate, async (req, res) => {
  try {
    const { plantId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { rows } = await query(
      `SELECT ss.*, u1.full_name AS submitted_by_name, u2.full_name AS approved_by_name
       FROM submission_status ss
       LEFT JOIN users u1 ON ss.submitted_by = u1.id
       LEFT JOIN users u2 ON ss.approved_by = u2.id
       WHERE ss.plant_id = $1 AND ss.entry_date = $2
       ORDER BY ss.module`,
      [plantId, date]
    );
    const modules = ['power', 'fuel', 'performance', 'water', 'availability', 'scheduling', 'operations', 'ash', 'dsm'];
    const map = rows.reduce((a, r) => ({ ...a, [r.module]: r }), {});
    const full = modules.map(m => map[m] || { module: m, status: 'not_started' });
    return success(res, { date, plantId, modules: full });
  } catch (err) {
    return error(res, 'Failed to fetch submission status', 500);
  }
});

// GET /api/data-entry/submission/pending/approvals — for SIC dashboard
router.get('/pending/approvals', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ss.*, p.name AS plant_name, p.short_name,
              u.full_name AS submitted_by_name
       FROM submission_status ss
       JOIN plants p ON ss.plant_id = p.id
       LEFT JOIN users u ON ss.submitted_by = u.id
       WHERE ss.status = 'submitted'
         AND ($1::text[] IS NULL OR ss.plant_id::text = ANY($1::text[]))
       ORDER BY ss.submitted_at ASC
       LIMIT 50`,
      [req.user.role === 'it_admin' ? null : req.user.plantIds]
    );
    return success(res, { pending: rows, count: rows.length });
  } catch (err) {
    return error(res, 'Failed to fetch pending approvals', 500);
  }
});

module.exports = router;
