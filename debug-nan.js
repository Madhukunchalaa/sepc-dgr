require('dotenv').config();
const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine.js');
const { Pool } = require('pg');

const p = new Pool({ user: 'dgr_user', password: '1234', database: 'dgr_platform', port: 5432 });

async function run() {
    const { rows } = await p.query("SELECT id FROM plants WHERE short_name='TTPP' LIMIT 1");
    if (!rows.length) return;
    const plantId = rows[0].id;

    // Testing a day with seeded data
    const dgr = await assembleDGR(plantId, '2025-05-15');

    const perf = dgr.sections.find(s => s.title.includes('PERFORMANCE'));
    console.log('\n--- PERFORMANCE SECTION ---');
    console.log(perf.rows);

    process.exit(0);
}

run();
