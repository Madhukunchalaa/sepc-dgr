// Check APC % for Jan 2, 2026
process.env.DB_USER = 'dgr_user';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'dgr_platform';
process.env.DB_PASSWORD = '1234';
process.env.DB_PORT = '5432';
process.env.JWT_SECRET = 'supersecretkey';

const { assembleDGR } = require('./engines/dgr.engine');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'dgr_user', host: 'localhost',
    database: 'dgr_platform', password: '1234', port: 5432
});

async function check() {
    const plantId = '36cd41f9-b150-46da-a778-a838679a343f';
    const date = '2026-01-02';

    // 1. Raw DB values
    const { rows } = await pool.query(
        `SELECT entry_date, generation_mu, export_mu, import_mu, apc_mu, apc_pct, avg_load_mw
     FROM daily_power WHERE plant_id = $1 AND entry_date = $2`,
        [plantId, date]
    );
    console.log('=== Raw DB row ===');
    console.log(JSON.stringify(rows[0], null, 2));

    // 2. Manual APC % calculation: APC % = (APC MU / Generation MU) * 100
    if (rows[0]) {
        const gen = Number(rows[0].generation_mu);
        const apc = Number(rows[0].apc_mu);
        const storedPct = Number(rows[0].apc_pct);
        const calcPct = gen > 0 ? (apc / gen) * 100 : 0;
        console.log('\n=== APC % Comparison ===');
        console.log('Stored apc_pct:          ', storedPct.toFixed(4));
        console.log('Calculated (APC/Gen*100):', calcPct.toFixed(4));
        console.log('Match:', Math.abs(storedPct - calcPct) < 0.01 ? 'YES' : 'NO - MISMATCH!');
    }

    // 3. DGR engine result
    const dgr = await assembleDGR(plantId, date);
    console.log('\n=== DGR Engine APC section ===');
    console.log(JSON.stringify(dgr.power.apc, null, 2));

    // 4. Check MTD values
    const mtdRows = await pool.query(
        `SELECT entry_date, apc_mu, apc_pct, generation_mu
     FROM daily_power
     WHERE plant_id = $1 AND entry_date >= '2026-01-01' AND entry_date <= '2026-01-02'
     ORDER BY entry_date`,
        [plantId]
    );
    console.log('\n=== All days in MTD (Jan 1-2) ===');
    let totalApc = 0, totalGen = 0;
    for (const r of mtdRows.rows) {
        console.log(`  ${r.entry_date}: gen=${r.generation_mu}, apc=${r.apc_mu}, apc_pct=${r.apc_pct}`);
        totalApc += Number(r.apc_mu || 0);
        totalGen += Number(r.generation_mu || 0);
    }
    const mtdPctWeighted = totalGen > 0 ? (totalApc / totalGen) * 100 : 0;
    const mtdPctSimpleAvg = mtdRows.rows.reduce((s, r) => s + Number(r.apc_pct || 0), 0) / mtdRows.rows.length;
    console.log(`  MTD APC % (weighted = totalAPC/totalGen*100): ${mtdPctWeighted.toFixed(4)}`);
    console.log(`  MTD APC % (simple avg of daily pct):          ${mtdPctSimpleAvg.toFixed(4)}`);

    await pool.end();
    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
