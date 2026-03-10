const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

const N = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; };

async function testUpsert() {
    const plantId = '78920445-14de-4144-b736-8dc7a5849ca1';
    const date = '2026-03-02';

    // Sample data similar to what frontend sends
    const d = {
        hfo_t10_lvl_calc: 100,
        hfo_t10_lvl_panel: 105,
        gen_main_meter: 5000,
        net_export: 4800,
        net_import_sy: 10,
        status: 'draft'
    };

    try {
        console.log('--- Testing Manual Upsert ---');
        const fields = Object.keys(d).filter(k => k !== 'status');
        const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
        const values = [plantId, date, ...fields.map(f => N(d[f]) !== null ? N(d[f]) : d[f])];

        const query = `INSERT INTO taqa_daily_input (plant_id, entry_date, ${fields.join(', ')})
           VALUES ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(', ')})
           ON CONFLICT (plant_id, entry_date) DO UPDATE SET
             ${setClauses}, updated_at = NOW()`;

        console.log('Running Query...');
        await pool.query(query, values);
        console.log('✅ Upsert successful!');

        // Verify it was saved
        const res = await pool.query("SELECT * FROM taqa_daily_input WHERE plant_id=$1 AND entry_date=$2", [plantId, date]);
        console.log('Stored Data:', res.rows[0]);

    } catch (e) {
        console.error('❌ ERROR:', e.message);
        if (e.detail) console.error('Detail:', e.detail);
    } finally {
        await pool.end();
    }
}
testUpsert();
