const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

const TAQA_ID = '36cd41f9-b150-46da-a778-a838679a343f';
const DATE = '2026-01-10';

async function simulate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Inserting into taqa_daily_input...');
        await client.query(
            `INSERT INTO taqa_daily_input (plant_id, entry_date, hfo_t10_lvl_calc, remarks)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (plant_id, entry_date) DO UPDATE SET hfo_t10_lvl_calc = $3, remarks = $4`,
            [TAQA_ID, DATE, 123.45, 'Simulated save from diagnostic']
        );
        console.log('Inserting into submission_status...');
        await client.query(
            `INSERT INTO submission_status (plant_id, entry_date, module, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (plant_id, entry_date, module) DO UPDATE SET status = $4`,
            [TAQA_ID, DATE, 'power', 'draft']
        );
        await client.query('COMMIT');
        console.log('Transaction committed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Simulation failed:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
simulate();
