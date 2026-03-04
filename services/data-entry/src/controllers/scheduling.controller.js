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
        const values = [
            plantId, date,
            data.dcSepcMu, data.dcTnpdclMu, data.sgPpaMu, data.sgDamMu, data.sgRtmMu,
            data.ursDamMwh, data.ursRtmMwh, data.ursRevenue, data.remarks,
            data.ursNetProfitLacs,
            data.dcLossReasons ? JSON.stringify(data.dcLossReasons) : '[]',
            data.askingRateMw, data.deemedGenMu,
            data.lossCoalMu, data.lossCoalPct, data.lossCreSmpsMu, data.lossCreSmpsPct,
            data.lossBunkerMu, data.lossBunkerPct, data.lossAohMu, data.lossAohPct,
            data.lossVacuumMu, data.lossVacuumPct
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
