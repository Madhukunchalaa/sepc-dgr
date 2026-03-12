const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    try {
        await pool.query(
            "UPDATE plants SET name = 'SEPC Power Private Limited — TTPP Stage I', company_name = 'SEPC Power Pvt Ltd' WHERE short_name = 'TTPP'"
        );
        console.log('Fixed SEPC plant name');

        const verify = await pool.query("SELECT id, short_name, name, company_name FROM plants");
        verify.rows.forEach(r => console.log(`  ${r.short_name}: name="${r.name}" company="${r.company_name}"`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
