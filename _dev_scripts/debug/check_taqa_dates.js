const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function checkDates() {
    try {
        const { rows } = await pool.query('SELECT entry_date, status FROM taqa_daily_input');
        console.log('Available TAQA Dates:', rows);
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
checkDates();
