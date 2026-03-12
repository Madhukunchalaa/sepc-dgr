const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const dates = ['2026-01-10', '2026-10-01', '2026-03-10', '2026-03-09'];
        console.log('--- Checking Specific Dates Across All Plants ---');
        for (const d of dates) {
            const r = await pool.query('SELECT plant_id, entry_date, status FROM taqa_daily_input WHERE entry_date = $1', [d]);
            console.log(`Date ${d}: Found ${r.rows.length} rows`);
            r.rows.forEach(row => console.log(`  Plant: ${row.plant_id}, Status: ${row.status}`));
        }
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
