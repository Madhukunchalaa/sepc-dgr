const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        const res = await pool.query("SELECT entry_date, status FROM taqa_daily_input ORDER BY entry_date DESC LIMIT 10");
        console.log('Seeded dates found:');
        res.rows.forEach(r => console.log(`  ${r.entry_date.toISOString().split('T')[0]} - Status: ${r.status}`));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
run();
