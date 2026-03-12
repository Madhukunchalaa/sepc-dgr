const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- Users and Roles ---');
        const { rows: users } = await pool.query('SELECT id, email, full_name, role FROM users');
        for (const u of users) {
            const { rows: up } = await pool.query('SELECT plant_id FROM user_plants WHERE user_id = $1', [u.id]);
            const plantIds = up.map(r => r.plant_id);
            console.log(`User: ${u.email}, Role: ${u.role}, FullName: ${u.full_name}, Plants: ${plantIds.join(', ') || 'NONE'}`);
        }
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await pool.end();
    }
}
check();
