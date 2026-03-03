exports.getDsmEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        const { rows } = await require('../shared/db').query(
            `SELECT * FROM daily_dsm WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );
        res.json(rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.upsertDsmEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        const { query } = require('../shared/db');
        const q = `
      INSERT INTO daily_dsm (
        plant_id, entry_date,
        dsm_net_profit_lacs, dsm_payable_lacs, dsm_receivable_lacs, dsm_coal_saving_lacs,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        dsm_net_profit_lacs = EXCLUDED.dsm_net_profit_lacs,
        dsm_payable_lacs = EXCLUDED.dsm_payable_lacs,
        dsm_receivable_lacs = EXCLUDED.dsm_receivable_lacs,
        dsm_coal_saving_lacs = EXCLUDED.dsm_coal_saving_lacs,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [plantId, date, data.dsm_net_profit_lacs, data.dsm_payable_lacs, data.dsm_receivable_lacs, data.dsm_coal_saving_lacs];
        const { rows } = await query(q, values);
        res.json({ message: 'Saved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save dsm data' });
    }
};
