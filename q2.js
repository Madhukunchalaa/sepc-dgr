const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', host: 'localhost', port: 5432 });

async function run() {
    console.log("Fuel (H2 Cons):");
    const r1 = await pool.query("SELECT h2_cons FROM daily_fuel WHERE entry_date='2025-06-11'");
    console.log(r1.rows);

    console.log("\nWater:");
    const r2 = await pool.query("SELECT * FROM daily_water WHERE entry_date='2025-06-11'");
    console.log(r2.rows);

    console.log("\nAsh:");
    const r3 = await pool.query("SELECT * FROM daily_ash WHERE entry_date='2025-06-11'");
    console.log(r3.rows);

    process.exit(0);
}
run();
