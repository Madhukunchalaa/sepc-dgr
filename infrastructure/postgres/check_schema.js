const { Pool } = require('pg');
const p = new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', port: 5432 });
p.query("SELECT column_name FROM information_schema.columns WHERE table_name='daily_scheduling'").then(r => {
    console.log(r.rows.map(ro => ro.column_name).join(', '));
    process.exit(0);
});
