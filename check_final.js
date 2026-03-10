const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT plant_id::text, entry_date::text, remarks FROM taqa_daily_input");
        console.log(`Total Rows in taqa_daily_input: ${rows.length}`);
        rows.forEach(r => console.log(JSON.stringify(r)));

        const { rows: ss } = await pool.query("SELECT plant_id::text, entry_date::text, module FROM submission_status WHERE entry_date = '2026-01-10'");
        console.log(`\nRows in submission_status for Jan 10: ${ss.length}`);
        ss.forEach(r => console.log(JSON.stringify(r)));
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
