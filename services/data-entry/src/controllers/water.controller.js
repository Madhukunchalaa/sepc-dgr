// services/data-entry/src/controllers/water.controller.js
const { query } = require('../shared/db');

exports.getEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        if (!plantId || !date) return res.status(400).json({ error: 'Missing plantId or date' });

        const { rows } = await query(
            `SELECT * FROM daily_water WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );

        // Simple diagnostics to help trace date/plant issues
        console.log('[water.getEntry]', { plantId, date, found: rows.length });

        res.json({ data: rows[0] || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving water data' });
    }
};

exports.upsertEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        if (!plantId || !date || !data) return res.status(400).json({ error: 'Invalid payload' });

        // Fetch power generation to auto-calculate the DM Cycle Pct
        const { rows: pwRows } = await query(`SELECT generation_mu FROM daily_power WHERE plant_id = $1 AND entry_date = $2`, [plantId, date]);
        const genMu = Number(pwRows[0]?.generation_mu || 0);

        const dm_makeup = Number(data.dmCycleMakeupM3 || 0);
        const dm_pct = genMu > 0 ? (dm_makeup * 100) / (genMu * 1000) : null;

        const q = `
      INSERT INTO daily_water (
        plant_id, entry_date, 
        dm_generation_m3, dm_cycle_makeup_m3, dm_cycle_pct, dm_total_cons_m3, dm_stock_m3,
        service_water_m3, potable_water_m3, sea_water_m3,
        swi_flow_m3, outfall_m3,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        dm_generation_m3 = EXCLUDED.dm_generation_m3,
        dm_cycle_makeup_m3 = EXCLUDED.dm_cycle_makeup_m3,
        dm_cycle_pct = EXCLUDED.dm_cycle_pct,
        dm_total_cons_m3 = EXCLUDED.dm_total_cons_m3,
        dm_stock_m3 = EXCLUDED.dm_stock_m3,
        service_water_m3 = EXCLUDED.service_water_m3,
        potable_water_m3 = EXCLUDED.potable_water_m3,
        sea_water_m3 = EXCLUDED.sea_water_m3,
        swi_flow_m3 = EXCLUDED.swi_flow_m3,
        outfall_m3 = EXCLUDED.outfall_m3,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [
            plantId, date,
            data.dmGenerationM3, data.dmCycleMakeupM3, dm_pct, data.dmTotalConsM3, data.dmStockM3,
            data.serviceWaterM3, data.potableWaterM3, data.seaWaterM3,
            data.swiFlowM3, data.outfallM3
        ];

        const { rows } = await query(q, values);
        res.json({ message: 'Water data saved', data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save water data' });
    }
};

exports.submitEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_water SET status = 'submitted', submitted_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Water data submitted', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit' });
    }
};

exports.approveEntry = async (req, res) => {
    try {
        const { plantId, date } = req.body;
        const { rows } = await query(
            `UPDATE daily_water SET status = 'approved', approved_at = NOW() 
       WHERE plant_id = $1 AND entry_date = $2 RETURNING *`,
            [plantId, date]
        );
        res.json({ message: 'Water data approved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve' });
    }
};
