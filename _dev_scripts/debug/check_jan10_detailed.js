const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT module, status, entry_date::text FROM submission_status WHERE plant_id = '36cd41f9-b150-46da-a778-a838679a343f' AND entry_date = '2026-01-10'");
        console.log(`Rows for Jan 10: ${rows.length}`);
        rows.forEach(r => console.log(JSON.stringify(r)));
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
