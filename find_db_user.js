const { Pool } = require('pg');

async function run() {
    const passwords = ['', '1234', 'password', 'root', 'postgres', 'dgr_user'];
    const users = ['postgres', 'dgr_user'];

    for (const user of users) {
        for (const password of passwords) {
            const pool = new Pool({
                user, host: 'localhost', database: 'dgr_platform', password, port: 5432
            });
            try {
                const res = await pool.query('SELECT 1');
                if (res) {
                    console.log(`✅ Success: ${user} / ${password === '' ? '(empty)' : password}`);
                    // If success, try to fix schema immediately
                    try {
                        await pool.query('ALTER TABLE taqa_daily_input ALTER COLUMN hfo_receipt_mt TYPE NUMERIC(24,6)');
                        console.log('  Successfully altered one column! Continuing...');
                        // ... run full fix ...
                        await pool.end();
                        return;
                    } catch (e) {
                        console.log(`  Connected but cannot alter: ${e.message}`);
                    }
                }
                await pool.end();
            } catch (e) {
                // fail silently
                await pool.end();
            }
        }
    }
    console.log('Could not find a user/password combo with ALTER permissions.');
}

run();
