const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432 });

async function fixPermissions() {
    try {
        console.log('Granting permissions to dgr_user on public schema...');
        await pool.query('GRANT ALL ON SCHEMA public TO dgr_user;');
        await pool.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dgr_user;');
        await pool.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dgr_user;');
        console.log('✅ Permissions granted successfully!');
    } catch (e) {
        console.error('❌ ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
fixPermissions();
