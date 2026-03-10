const { Client } = require('pg');

async function run() {
    const c = new Client({
        host: 'localhost',
        port: 5432,
        database: 'dgr_platform',
        user: 'dgr_user',
        password: '1234'
    });

    try {
        await c.connect();
        console.log("Connected locally");
        const taqa = await c.query(`SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1`);
        if (taqa.rows.length === 0) return console.log('No TAQA plant locally');

        const pid = taqa.rows[0].id;
        console.log("TAQA Plant ID:", pid);

        // Find rows with actual data (where gen_main_meter is not null)
        const res = await c.query('SELECT entry_date, status, gen_main_meter FROM taqa_daily_input WHERE plant_id=$1 AND gen_main_meter IS NOT NULL ORDER BY entry_date DESC', [pid]);

        if (res.rows.length === 0) {
            console.log("No populated TAQA data found locally either.");
        } else {
            console.log(`Found ${res.rows.length} populated dates locally:`);
            res.rows.forEach(r => {
                const dateStr = new Date(r.entry_date).toISOString().split('T')[0];
                console.log(`- Date: ${dateStr} | Status: ${r.status} | Gen Meter: ${r.gen_main_meter}`);
            });
        }

    } catch (e) {
        console.error("Local DB error:", e.message);
    } finally {
        await c.end();
    }
}

run();
