const { Pool } = require('pg');
const pool = new Pool({
    user: 'dgr_user', host: 'localhost', database: 'dgr_platform', password: '1234', port: 5432
});

async function run() {
    const res = await pool.query(`
        SELECT pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conname = 'submission_status_module_check'
    `);
    const def = res.rows[0].pg_get_constraintdef;
    console.log('Full Definition:', def);

    // Extract everything inside ARRAY[...]
    const arrayPart = def.substring(def.indexOf('ARRAY[') + 6, def.lastIndexOf(']'));
    const modules = arrayPart.split(',').map(m => {
        const cleaned = m.trim().replace(/^\(/, '').replace(/'/g, '').split('::')[0];
        return cleaned;
    });
    console.log('Mapped Modules:', modules);
}
run().finally(() => pool.end());
