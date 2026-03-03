const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    user: 'dgr_user',
    host: 'localhost',
    database: 'dgr_platform',
    password: '1234',
    port: 5432
});

async function run() {
    try {
        console.log(`Querying Data for 2025-04-08...`);
        const { rows: plants } = await pool.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = plants[0].id;

        const powerRes = await pool.query("SELECT * FROM daily_power WHERE plant_id = $1 AND entry_date = '2025-04-08'", [plantId]);
        const waterRes = await pool.query("SELECT * FROM daily_water WHERE plant_id = $1 AND entry_date = '2025-04-08'", [plantId]);

        if (powerRes.rows.length) {
            fs.writeFileSync('Target_DB_Power.json', JSON.stringify(powerRes.rows[0], null, 2));
            console.log("Saved Target_DB_Power.json");
        } else {
            console.log("No Power data in DB for 2025-04-08");
        }

        if (waterRes.rows.length) {
            fs.writeFileSync('Target_DB_Water.json', JSON.stringify(waterRes.rows[0], null, 2));
            console.log("Saved Target_DB_Water.json");
        } else {
            console.log("No Water data in DB for 2025-04-08");
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
