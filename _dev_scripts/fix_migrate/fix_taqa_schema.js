const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        console.log('Expanding numeric column precision in taqa_daily_input...');

        // Fetch all numeric columns in taqa_daily_input
        const res = await pool.query(`
            SELECT column_name, data_type, numeric_precision, numeric_scale 
            FROM information_schema.columns 
            WHERE table_name = 'taqa_daily_input' AND data_type = 'numeric'
        `);

        for (const col of res.rows) {
            // Increase precision to 24 for all numeric columns to prevent overflow
            // Keep the original scale (decimal places)
            const scale = col.numeric_scale || 0;
            const alterQuery = `ALTER TABLE taqa_daily_input ALTER COLUMN ${col.column_name} TYPE NUMERIC(24, ${scale})`;
            await pool.query(alterQuery);
        }

        console.log('✅ Schema expanded successfully.');
    } catch (e) {
        console.error('❌ Schema fix failed:', e.message);
    } finally {
        await pool.end();
    }
}
run();
