const { Pool } = require('pg');
const p = new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', port: 5432 });
async function check() {
    try {
        const { rows } = await p.query("SELECT * FROM daily_availability LIMIT 1");
        console.log('Availability columns:', Object.keys(rows[0] || {}));
        const { rows: stats } = await p.query("SELECT entry_date, paf_pct, paf_tnpdcl FROM daily_availability WHERE plant_id=(SELECT id FROM plants WHERE short_name='TTPP' LIMIT 1) AND entry_date='2025-05-15'");
        console.log('2025-05-15 Availability:', stats);

        const { rows: fuelRows } = await p.query("SELECT * FROM daily_fuel LIMIT 1");
        console.log('Fuel columns:', Object.keys(fuelRows[0] || {}));
    } catch (e) { console.error(e); }
    process.exit(0);
}
check();
