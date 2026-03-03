exports.getAshEntry = async (req, res) => {
    try {
        const { plantId, date } = req.params;
        const { rows } = await require('../shared/db').query(
            `SELECT * FROM daily_ash WHERE plant_id = $1 AND entry_date = $2`,
            [plantId, date]
        );
        res.json(rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.upsertAshEntry = async (req, res) => {
    try {
        const { plantId, date, data } = req.body;
        const { query } = require('../shared/db');
        const q = `
      INSERT INTO daily_ash (
        plant_id, entry_date,
        fa_generated_mt, fa_to_user_mt, fa_to_dyke_mt, fa_silo_mt,
        ba_generated_mt, ba_to_user_mt, ba_to_dyke_mt, ba_silo_mt,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', NOW()
      ) ON CONFLICT (plant_id, entry_date) DO UPDATE SET
        fa_generated_mt = EXCLUDED.fa_generated_mt,
        fa_to_user_mt = EXCLUDED.fa_to_user_mt,
        fa_to_dyke_mt = EXCLUDED.fa_to_dyke_mt,
        fa_silo_mt = EXCLUDED.fa_silo_mt,
        ba_generated_mt = EXCLUDED.ba_generated_mt,
        ba_to_user_mt = EXCLUDED.ba_to_user_mt,
        ba_to_dyke_mt = EXCLUDED.ba_to_dyke_mt,
        ba_silo_mt = EXCLUDED.ba_silo_mt,
        status = 'draft',
        updated_at = NOW()
      RETURNING *;
    `;
        const values = [plantId, date, data.fa_generated_mt, data.fa_to_user_mt, data.fa_to_dyke_mt, data.fa_silo_mt, data.ba_generated_mt, data.ba_to_user_mt, data.ba_to_dyke_mt, data.ba_silo_mt];
        const { rows } = await query(q, values);
        res.json({ message: 'Saved', data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save ash data' });
    }
};
