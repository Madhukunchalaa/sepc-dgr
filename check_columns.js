const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'taqa_daily_input'");
        console.log('Columns in taqa_daily_input:');
        rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
