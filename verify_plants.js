const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- Plant Properties Check ---');
        const { rows: plants } = await pool.query("SELECT id, short_name, LENGTH(short_name) as len, name FROM plants");
        plants.forEach(p => {
            console.log(`ID: ${p.id}, Short: [${p.short_name}], Len: ${p.len}, Name: ${p.name}`);
        });

        console.log('\n--- Jan 10 Data Exact Match ---');
        const { rows: data } = await pool.query("SELECT plant_id, entry_date::text FROM taqa_daily_input WHERE entry_date = '2026-01-10'");
        console.log(`Matching rows: ${data.length}`);
        data.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
