const { Pool } = require('pg');
const pool = new Pool({ user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function checkMeters() {
    try {
        const { rows } = await pool.query(`
            SELECT p.short_name, m.meter_code, m.meter_name, m.is_active
            FROM meter_points m
            JOIN plants p ON m.plant_id = p.id
            WHERE p.short_name = 'TTPP'
            ORDER BY m.sort_order
        `);
        console.log('TTPP Meters:');
        rows.forEach(r => console.log(`  [${r.meter_code}] ${r.meter_name} (Active: ${r.is_active})`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
checkMeters();
