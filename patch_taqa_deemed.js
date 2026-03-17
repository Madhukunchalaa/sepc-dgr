/**
 * patch_taqa_deemed.js
 * Fix deemed_gen_mwhr: DB had R39 (schedule ~4820 MWh); must be R38 (dispatch demand ~1180/560 MWh)
 * Excel R38 = Dispatch Demand (TANGEDCO actual), R39 = DD%
 */
process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

// R38 values from Excel (actual Dispatch Demand MWhr)
const patches = [
  { date: '2025-08-19', deemed_gen_mwhr: 1180 },
  { date: '2025-12-05', deemed_gen_mwhr: 560  },
  { date: '2026-01-21', deemed_gen_mwhr: 1180 },
];

async function main() {
  for (const { date, deemed_gen_mwhr } of patches) {
    const res = await pool.query(
      `UPDATE taqa_daily_input SET deemed_gen_mwhr = $1
       WHERE plant_id = $2 AND entry_date = $3 RETURNING id`,
      [deemed_gen_mwhr, PID, date]
    );
    console.log(`${date}: updated ${res.rowCount} row(s) → deemed_gen_mwhr=${deemed_gen_mwhr}`);
  }
  await pool.end();
  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
