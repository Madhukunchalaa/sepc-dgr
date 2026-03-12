const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        // First check the schema
        const cols = await pool.query(
            "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='plants' ORDER BY ordinal_position"
        );
        console.log('Plants table columns:');
        cols.rows.forEach(c => console.log(`  ${c.column_name} nullable=${c.is_nullable} default=${c.column_default}`));

        // Check existing SEPC plant for reference
        const sepc = await pool.query("SELECT * FROM plants WHERE short_name='TTPP'");
        if (sepc.rows.length > 0) {
            console.log('\nSEPC plant reference:');
            console.log(JSON.stringify(sepc.rows[0], null, 2));
        }

        // Check if TAQA already exists
        const existing = await pool.query("SELECT id FROM plants WHERE short_name='TAQA'");
        if (existing.rows.length > 0) {
            console.log('\nTAQA plant already exists!');
            return;
        }

        // Insert TAQA using SEPC as a template
        const s = sepc.rows[0];
        const id = '36cd41f9-b150-46da-a778-a838679a343f';
        await pool.query(
            `INSERT INTO plants (id, name, short_name, company_name, capacity_mw, plf_base_mw, location, fy_start_month)
             VALUES ($1, 'TAQA MEIL Neyveli Energy Pvt Ltd', 'TAQA', 'TAQA MEIL Neyveli Energy Pvt Ltd', 250, 250, 'Neyveli', $2)`,
            [id, s.fy_start_month || 4]
        );
        console.log('\n✅ TAQA plant inserted successfully!');

        // Verify
        const verify = await pool.query("SELECT id, short_name, name, capacity_mw FROM plants");
        console.log('\nAll plants:');
        verify.rows.forEach(r => console.log(`  ${r.short_name}: ${r.name} (${r.capacity_mw} MW)`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
