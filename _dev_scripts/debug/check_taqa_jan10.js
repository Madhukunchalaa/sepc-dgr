const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT * FROM taqa_daily_input WHERE plant_id = '36cd41f9-b150-46da-a778-a838679a343f' AND entry_date = '2026-01-10'");
        console.log(`Rows in taqa_daily_input for TAQA on 2026-01-10: ${rows.length}`);
        if (rows.length > 0) {
            console.log('Row details:', JSON.stringify(rows[0]));
        }
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
