const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    const taqa_id = '36cd41f9-b150-46da-a778-a838679a343f';
    const ttpp_id = '78920445-14de-4144-b736-8dc7a5849ca1';

    const taqa = await pool.query("SELECT id, short_name, name, capacity_mw FROM plants WHERE id = $1", [taqa_id]);
    const ttpp = await pool.query("SELECT id, short_name, name, capacity_mw FROM plants WHERE id = $1", [ttpp_id]);

    console.log('TAQA Record:', JSON.stringify(taqa.rows[0], null, 2));
    console.log('TTPP Record:', JSON.stringify(ttpp.rows[0], null, 2));

    // Check data counts for each
    const taqaData = await pool.query("SELECT count(*) FROM taqa_daily_input WHERE plant_id = $1", [taqa_id]);
    const ttppData = await pool.query("SELECT count(*) FROM taqa_daily_input WHERE plant_id = $1", [ttpp_id]);

    console.log('Records in taqa_daily_input for TAQA ID:', taqaData.rows[0].count);
    console.log('Records in taqa_daily_input for TTPP ID:', ttppData.rows[0].count);
}

run().catch(console.error).finally(() => pool.end());
