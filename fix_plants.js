const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function fix() {
    const ttpp_id = '78920445-14de-4144-b736-8dc7a5849ca1';
    const taqa_id = '36cd41f9-b150-46da-a778-a838679a343f';

    const res1 = await pool.query("UPDATE plants SET short_name = 'TTPP' WHERE id = $1", [ttpp_id]);
    console.log(`Updated TTPP ShortName. RowCount: ${res1.rowCount}`);

    const res2 = await pool.query("UPDATE plants SET short_name = 'TAQA' WHERE id = $1", [taqa_id]);
    console.log(`Updated TAQA ShortName. RowCount: ${res2.rowCount}`);

    const check = await pool.query("SELECT id, short_name, name FROM plants");
    console.table(check.rows);
}

fix().catch(console.error).finally(() => pool.end());
