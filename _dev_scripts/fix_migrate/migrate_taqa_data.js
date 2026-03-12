const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

const TAQA_ID = '36cd41f9-b150-46da-a778-a838679a343f';
const TTPP_ID = '78920445-14de-4144-b736-8dc7a5849ca1';

async function migrate() {
    console.log('--- STARTING MIGRATION ---');

    // Migrate taqa_daily_input
    const res1 = await pool.query('UPDATE taqa_daily_input SET plant_id = $1 WHERE plant_id = $2', [TAQA_ID, TTPP_ID]);
    console.log(`Migrated ${res1.rowCount} records in taqa_daily_input to TAQA ID.`);

    // Also migrate submission_status records that were created for modules in TAQA but assigned to TTPP
    // (Only if they involve 'ops-input' or similar logic, but to be safe, let's only migrate those that overlap with taqa_daily_input dates)
    const res2 = await pool.query(`
    UPDATE submission_status 
    SET plant_id = $1 
    WHERE plant_id = $2 
    AND module IN ('power', 'fuel', 'performance', 'availability', 'scheduling', 'water', 'ash')
    AND entry_date IN (SELECT entry_date FROM taqa_daily_input WHERE plant_id = $1)
  `, [TAQA_ID, TTPP_ID]);
    console.log(`Migrated ${res2.rowCount} records in submission_status to TAQA ID.`);
}

migrate().catch(console.error).finally(() => pool.end());
