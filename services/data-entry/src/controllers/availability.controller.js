// services/data-entry/src/controllers/availability.controller.js
const { query } = require('../shared/db');

exports.getEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        if (!plantId || !date) return res.status(400).json({ error: 'Missing plantId or date' });

        const { rows } = await query(
            `SELECT * FROM daily_availability WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );
        res.json({ data: rows[0] || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving availability data' });
    }
};

exports.upsertEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        if (!plantId || !date || !data) return res.status(400).json({ error: 'Invalid payload' });

        const q = `
      INSERT INTO daily_availability (
        plant_id, entry_date, 
        on_bar_hours, rsd_hours, forced_outage_hrs, planned_outage_hrs, paf_pct, paf_tnpdcl,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        on_bar_hours = EXCLUDED.on_bar_hours,
        rsd_hours = EXCLUDED.rsd_hours,
        forced_outage_hrs = EXCLUDED.forced_outage_hrs,
        planned_outage_hrs = EXCLUDED.planned_outage_hrs,
        paf_pct = EXCLUDED.paf_pct,
        paf_tnpdcl = EXCLUDED.paf_tnpdcl,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [
            plantId, date,
            data.onBarHours, data.rsdHours, data.forcedOutageHrs, data.plannedOutageHrs, data.pafPct, data.pafTnpdclPct
        ];

        const { rows } = await query(q, values);

        res.json({ message: 'Availability data saved', data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save availability data' });
    }
};

exports.submitEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_availability SET status = 'submitted', submitted_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Availability data submitted', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit' });
    }
};

exports.approveEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_availability SET status = 'approved', approved_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Availability data approved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve' });
    }
};

exports.unlockEntry = async (req, res) => {
    try {
        const { plantId, entryDate } = req.body;
        if (!['it_admin', 'plant_admin'].includes(req.user?.role)) {
            return res.status(403).json({ error: 'Only IT Admin or Plant Admin can unlock entries' });
        }
        await query(`UPDATE daily_availability SET status='draft', updated_at=NOW() WHERE plant_id=$1 AND entry_date=$2`, [plantId, entryDate]);
        await query(`UPDATE submission_status SET status='draft', updated_at=NOW() WHERE plant_id=$1 AND entry_date=$2 AND module='availability'`, [plantId, entryDate]);
        res.json({ message: 'Availability entry unlocked to draft' });
    } catch (err) {
        res.status(500).json({ error: 'Unlock failed' });
    }
};
