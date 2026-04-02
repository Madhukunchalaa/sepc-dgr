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
        urs_net_profit_lacs, dc_loss_reasons,
        asking_rate_mw, deemed_gen_mu, loss_coal_mu, loss_coal_pct, loss_cre_smps_mu, loss_cre_smps_pct,
        loss_bunker_mu, loss_bunker_pct, loss_aoh_mu, loss_aoh_pct, loss_vacuum_mu, loss_vacuum_pct,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'draft', NOW()
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
        urs_net_profit_lacs = EXCLUDED.urs_net_profit_lacs,
        dc_loss_reasons = EXCLUDED.dc_loss_reasons,
        asking_rate_mw = EXCLUDED.asking_rate_mw,
        deemed_gen_mu = EXCLUDED.deemed_gen_mu,
        loss_coal_mu = EXCLUDED.loss_coal_mu,
        loss_coal_pct = EXCLUDED.loss_coal_pct,
        loss_cre_smps_mu = EXCLUDED.loss_cre_smps_mu,
        loss_cre_smps_pct = EXCLUDED.loss_cre_smps_pct,
        loss_bunker_mu = EXCLUDED.loss_bunker_mu,
        loss_bunker_pct = EXCLUDED.loss_bunker_pct,
        loss_aoh_mu = EXCLUDED.loss_aoh_mu,
        loss_aoh_pct = EXCLUDED.loss_aoh_pct,
        loss_vacuum_mu = EXCLUDED.loss_vacuum_mu,
        loss_vacuum_pct = EXCLUDED.loss_vacuum_pct,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const parseNum = (val) => (val === '' || val == null ? null : Number(val));
        const values = [
            plantId, date,
            parseNum(data.dcSepcMu), parseNum(data.dcTnpdclMu), parseNum(data.sgPpaMu), parseNum(data.sgDamMu), parseNum(data.sgRtmMu),
            parseNum(data.ursDamMwh), parseNum(data.ursRtmMwh), parseNum(data.ursRevenue), data.remarks === '' ? null : (data.remarks ?? null),
            parseNum(data.ursNetProfitLacs),
            data.dcLossReasons ? JSON.stringify(data.dcLossReasons) : '[]',
            parseNum(data.askingRateMw), parseNum(data.deemedGenMu),
            parseNum(data.lossCoalMu), parseNum(data.lossCoalPct), parseNum(data.lossCreSmpsMu), parseNum(data.lossCreSmpsPct),
            parseNum(data.lossBunkerMu), parseNum(data.lossBunkerPct), parseNum(data.lossAohMu), parseNum(data.lossAohPct),
            parseNum(data.lossVacuumMu), parseNum(data.lossVacuumPct)
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

exports.unlockEntry = async (req, res) => {
    try {
        const { plantId, entryDate } = req.body;
        if (!['it_admin', 'plant_admin'].includes(req.user?.role)) {
            return res.status(403).json({ error: 'Only IT Admin or Plant Admin can unlock entries' });
        }
        await query(`UPDATE daily_scheduling SET status='draft', updated_at=NOW() WHERE plant_id=$1 AND entry_date=$2`, [plantId, entryDate]);
        await query(`UPDATE submission_status SET status='draft', updated_at=NOW() WHERE plant_id=$1 AND entry_date=$2 AND module='scheduling'`, [plantId, entryDate]);
        res.json({ message: 'Scheduling entry unlocked to draft' });
    } catch (err) {
        res.status(500).json({ error: 'Unlock failed' });
    }
};
