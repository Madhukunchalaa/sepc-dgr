const { Pool } = require('./node_modules/pg');
const pool = new Pool({
    host: 'localhost',
    database: 'dgr_platform',
    user: 'dgr_user',
    password: '1234',
    port: 5432
});

async function run() {
    try {
        const res = await pool.query(
            "INSERT INTO plants (name, short_name, location, company_name, capacity_mw, plf_base_mw, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            ['TAQA MEIL Neyveli Energy Pvt Ltd', 'TAQA', 'Uthangal, Neyveli, Tamilnadu', 'MEIL Neyveli Energy Pvt Ltd', 250.00, 250.00, 'active']
        );
        console.log('Created TAQA Plant ID:', res.rows[0].id);
    } catch (err) {
        if (err.code === '23505') {
            const existing = await pool.query("SELECT id FROM plants WHERE short_name = 'TAQA'");
            console.log('TAQA Plant already exists with ID:', existing.rows[0].id);
        } else {
            console.error('Error adding plant:', err);
        }
    } finally {
        await pool.end();
    }
}

run();
