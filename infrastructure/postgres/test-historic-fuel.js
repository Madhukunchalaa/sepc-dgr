const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: process.env.DB_PORT || 5432,
});

async function run() {
    try {
        const { rows: plants } = await pool.query(`SELECT id FROM plants WHERE short_name = 'TTPP' LIMIT 1`);
        const plantId = plants[0].id;

        console.log(`Querying DB for some historical dates for TTPP (${plantId}):\n`);
        const targetDates = ['2025-04-01', '2025-06-15', '2026-01-31', '2026-02-05'];

        for (const date of targetDates) {
            const { rows } = await pool.query(
                `SELECT coal_receipt_mt, ldo_cons_kl, hfo_cons_kl, coal_gcv_ar, h2_cons FROM daily_fuel WHERE plant_id = $1 AND entry_date = $2`,
                [plantId, date]
            );

            if (rows.length > 0) {
                console.log(`[${date}]:`, rows[0]);
            } else {
                console.log(`[${date}]: No data found`);
            }
        }

        console.log(`\nTesting DGR engine calculations for a historical date (2025-06-15):`);
        const { assembleDGR } = require('../../services/dgr-compute/src/engines/dgr.engine');
        const dgr = await assembleDGR(plantId, '2025-06-15');
        console.log(JSON.stringify(dgr.performance, null, 2));

    } catch (err) {
        console.error("Test failed", err);
    } finally {
        pool.end();
    }
}

run();
