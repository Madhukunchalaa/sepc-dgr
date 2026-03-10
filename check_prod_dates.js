const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

const TAQA_ID = '36cd41f9-b150-46da-a778-a838679a343f';
const SEPC_ID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

async function check() {
    try {
        console.log('--- Checking TAQA ID ---');
        const r1 = await pool.query('SELECT entry_date, status FROM taqa_daily_input WHERE plant_id = $1 ORDER BY entry_date DESC', [TAQA_ID]);
        console.log(`Found ${r1.rows.length} rows for TAQA (${TAQA_ID})`);
        r1.rows.forEach(r => console.log(`  Date: ${r.entry_date.toISOString().split('T')[0]}, Status: ${r.status}`));

        console.log('\n--- Checking SEPC ID ---');
        const r2 = await pool.query('SELECT entry_date, status FROM taqa_daily_input WHERE plant_id = $1 ORDER BY entry_date DESC', [SEPC_ID]);
        console.log(`Found ${r2.rows.length} rows for SEPC (${SEPC_ID})`);
        r2.rows.forEach(r => console.log(`  Date: ${r.entry_date.toISOString().split('T')[0]}, Status: ${r.status}`));

    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
