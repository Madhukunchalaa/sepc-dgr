// services/data-entry/src/controllers/scheduling.controller.js
const { query } = require('../shared/db');

exports.getEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        if (!plantId || !date) return res.status(400).json({ error: 'Missing plantId or date' });

        const { rows } = await query(
            `SELECT * FROM daily_scheduling WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );
        res.json({ data: rows[0] || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving scheduling data' });
    }
};

exports.upsertEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        if (!plantId || !date || !data) return res.status(400).json({ error: 'Invalid payload' });

        const q = `
      INSERT INTO daily_scheduling (
        plant_id, entry_date, 
        dc_sepc_mu, dc_tnpdcl_mu, sg_ppa_mu, sg_dam_mu, sg_rtm_mu,
        urs_dam_mwh, urs_rtm_mwh, urs_revenue, remarks,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        dc_sepc_mu = EXCLUDED.dc_sepc_mu,
        dc_tnpdcl_mu = EXCLUDED.dc_tnpdcl_mu,
        sg_ppa_mu = EXCLUDED.sg_ppa_mu,
        sg_dam_mu = EXCLUDED.sg_dam_mu,
        sg_rtm_mu = EXCLUDED.sg_rtm_mu,
        urs_dam_mwh = EXCLUDED.urs_dam_mwh,
        urs_rtm_mwh = EXCLUDED.urs_rtm_mwh,
        urs_revenue = EXCLUDED.urs_revenue,
        remarks = EXCLUDED.remarks,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [
            plantId, date,
            data.dcSepcMu, data.dcTnpdclMu, data.sgPpaMu, data.sgDamMu, data.sgRtmMu,
            data.ursDamMwh, data.ursRtmMwh, data.ursRevenue, data.remarks
        ];

        const { rows } = await query(q, values);

        // Auto-update availability limits potentially
        // Sync to status 
        res.json({ message: 'Scheduling data saved', data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save scheduling data' });
    }
};

exports.submitEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_scheduling SET status = 'submitted', submitted_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Scheduling data submitted', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit' });
    }
};

exports.approveEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_scheduling SET status = 'approved', approved_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Scheduling data approved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve' });
    }
};
