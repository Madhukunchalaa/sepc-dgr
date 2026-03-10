const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT * FROM submission_status WHERE plant_id = '36cd41f9-b150-46da-a778-a838679a343f' AND entry_date = '2026-01-10'");
        console.log(`Found ${rows.length} rows for TAQA on 2026-01-10`);
        rows.forEach(r => console.log(JSON.stringify(r)));
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
