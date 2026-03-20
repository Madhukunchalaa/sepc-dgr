// services/data-entry/src/controllers/anpara.controller.js
const db = require('../shared/db');
const { query } = db;
const { success, error, notFound } = require('../shared/response');
const logger = require('../shared/logger');

const N = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; };

// GET — fetch saved entry for a date
async function getEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const { rows } = await query(
            'SELECT * FROM anpara_daily_input WHERE plant_id = $1 AND entry_date = $2',
            [plantId, date]
        );
        const row = rows[0];
        if (row && row.entry_date) {
            const d = row.entry_date;
            row.entry_date = typeof d === 'string'
                ? d.split('T')[0]
                : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        success(res, row || {});
    } catch (err) {
        logger.error('anpara.getEntry', { message: err.message });
        error(res, 'Failed to fetch Anpara entry');
    }
}

// POST — save/update raw input (draft)
async function upsertEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const d = req.body;
        const fields = Object.keys(d).filter(k => k !== 'status');
        if (!fields.length) return error(res, 'No data provided', 400);

        const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
        const values = [plantId, date, ...fields.map(f => N(d[f]))];

        await query(
            `INSERT INTO anpara_daily_input (plant_id, entry_date, ${fields.join(', ')})
             VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')})
             ON CONFLICT (plant_id, entry_date) DO UPDATE SET
             ${setClauses}, updated_at = NOW()`,
            values
        );

        success(res, { message: 'Anpara entry saved as draft', date });
    } catch (err) {
        logger.error('anpara.upsertEntry', { message: err.message });
        error(res, 'Failed to save Anpara entry: ' + err.message);
    }
}

// POST /submit — mark as submitted
async function submitEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const userId = req.user?.sub;

        const { rows } = await query(
            'SELECT * FROM anpara_daily_input WHERE plant_id = $1 AND entry_date = $2',
            [plantId, date]
        );
        if (!rows.length) return notFound(res, 'No Anpara entry found. Save data first.');

        await query(
            `UPDATE anpara_daily_input SET status='submitted', submitted_by=$3, submitted_at=NOW()
             WHERE plant_id=$1 AND entry_date=$2`,
            [plantId, date, userId]
        );

        logger.info('Anpara entry submitted', { plantId, date });
        success(res, { message: 'Anpara entry submitted successfully.' });
    } catch (err) {
        logger.error('anpara.submitEntry', { message: err.message });
        error(res, 'Failed to submit Anpara entry: ' + err.message);
    }
}

// POST /approve
async function approveEntry(req, res) {
    try {
        const { plantId, date } = req.params;
        const userId = req.user?.sub;

        await query(
            `UPDATE anpara_daily_input SET status='approved', approved_by=$3, approved_at=NOW()
             WHERE plant_id=$1 AND entry_date=$2`,
            [plantId, date, userId]
        );

        success(res, { message: 'Anpara entry approved' });
    } catch (err) {
        logger.error('anpara.approveEntry', { message: err.message });
        error(res, 'Failed to approve Anpara entry: ' + err.message);
    }
}

module.exports = { getEntry, upsertEntry, submitEntry, approveEntry };
