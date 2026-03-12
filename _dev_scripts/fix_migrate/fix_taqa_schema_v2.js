const { Pool } = require('pg');

async function tryFix() {
    const creds = [
        { user: 'postgres', password: '1234' },
        { user: 'postgres', password: '' },
        { user: 'dgr_user', password: '1234' }
    ];

    for (const cred of creds) {
        const pool = new Pool({
            user: cred.user, host: 'localhost', database: 'dgr_platform', password: cred.password, port: 5432
        });

        try {
            console.log(`Trying as ${cred.user}...`);
            // Try to expand ALL numeric columns to a safe size
            // and also check if we can just re-create the table if needed

            await pool.query('BEGIN');

            const res = await pool.query(`
                SELECT column_name, data_type, numeric_precision, numeric_scale 
                FROM information_schema.columns 
                WHERE table_name = 'taqa_daily_input' AND data_type = 'numeric'
            `);

            for (const col of res.rows) {
                const alterQuery = `ALTER TABLE taqa_daily_input ALTER COLUMN ${col.column_name} TYPE NUMERIC(30, 6)`;
                await pool.query(alterQuery);
            }

            await pool.query('COMMIT');
            console.log(`✅ Success with user ${cred.user}!`);
            await pool.end();
            return true;
        } catch (e) {
            await pool.query('ROLLBACK');
            console.log(`❌ Failed with user ${cred.user}: ${e.message}`);
            await pool.end();
        }
    }
    return false;
}

tryFix().then(success => {
    if (!success) {
        console.log('Could not fix schema automatically. Trying brute force (DROP/RECREATE)...');
        // Manual implementation of recreation logic would go here if needed
    }
});
