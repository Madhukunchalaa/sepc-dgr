const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query('SELECT * FROM submission_status ORDER BY entry_date DESC LIMIT 50');
        console.log(`Found ${rows.length} rows in submission_status`);
        rows.forEach(r => {
            console.log(`  Plant: ${r.plant_id}, Date: ${r.entry_date.toISOString().split('T')[0]}, Module: ${r.module}, Status: ${r.status}`);
        });
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
