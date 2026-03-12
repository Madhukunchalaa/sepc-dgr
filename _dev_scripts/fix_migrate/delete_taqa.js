const { Pool } = require('pg');

const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        console.log('--- START DELETING TAQA DATA ---');

        // Find TAQA plant_id by looking for 'taqa' in short_name
        const taqaRes = await pool.query("SELECT id FROM plants WHERE lower(short_name) LIKE '%taqa%'");
        if (taqaRes.rows.length === 0) {
            console.log('No TAQA plant found. Exiting.');
            return;
        }

        const taqaIds = taqaRes.rows.map(r => r.id);
        console.log('Found TAQA Plant IDs:', taqaIds);

        for (const taqaId of taqaIds) {
            console.log(`\nProcessing deletion for Plant ID: ${taqaId}`);

            // Find tables that have a `plant_id` column
            const tablesRes = await pool.query(`
                SELECT table_name
                FROM information_schema.columns
                WHERE column_name = 'plant_id' AND table_schema = 'public'
            `);
            const tables = tablesRes.rows.map(r => r.table_name);

            for (const table of tables) {
                console.log(`Deleting from ${table}...`);
                const deleteRes = await pool.query(`DELETE FROM ${table} WHERE plant_id = $1`, [taqaId]);
                console.log(`Deleted ${deleteRes.rowCount} rows from ${table}`);
            }

            // Delete from any roles/plant mappings if any (like user_plants - already covered by plant_id)

            // Finally delete the plant itself
            console.log(`Deleting from plants table...`);
            const plantDeleteRes = await pool.query(`DELETE FROM plants WHERE id = $1`, [taqaId]);
            console.log(`Deleted ${plantDeleteRes.rowCount} plant record(s)`);
        }

        console.log('\n--- TAQA DATA DELETED SUCCESSFULLY ---');

    } catch (err) {
        console.error('Error during deletion:', err);
    } finally {
        await pool.end();
    }
}

run();
