require('dotenv').config();
const { Pool } = require('pg');

process.env.DB_PASSWORD = '1234';

const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    try {
        const query = `
      ALTER TABLE daily_water 
        ALTER COLUMN dm_generation_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN dm_cycle_makeup_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN dm_total_cons_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN dm_stock_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN service_water_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN potable_water_m3 TYPE NUMERIC(20,3), 
        ALTER COLUMN sea_water_m3 TYPE NUMERIC(20,3),
        ALTER COLUMN dm_cycle_pct TYPE NUMERIC(20,3);
    `;
        await pool.query(query);
        console.log('Successfully altered daily_water columns to NUMERIC(20,3)');
    } catch (e) {
        console.error('Error altering table:', e);
    } finally {
        pool.end();
    }
}

run();
