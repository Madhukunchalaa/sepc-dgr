/**
 * patch_jan18_fuel.js
 * Fix fuel-section DB data for Jan-18 DGR (curr row = entry_date 2026-01-17T18:30)
 * to match Excel values.
 *
 * Patches:
 *  hfo_receipt_mt      = 0        (was 9999999.999 corrupt placeholder)
 *  hfo_supply_int_rdg  = prev     (same as Jan-17 entry => 0 HFO consumption)
 *  hfo_t10_lvl_calc    = 675.5    (strapLookup T10+T20 @ 155 => ~400 MT HFO stock)
 *  lignite_conv_1a_int_rdg = prev + 4901 = 6258946  (delta => 4901 MT belt weigher)
 *  lignite_bunker_lvl  = 50.55    (bunker correction => 5037 MT Bkr-corr consumption)
 *  lignite_receipt_taqa_wb = 5515
 *  lignite_lifted_nlcil_wb = 5519
 *  hsd_t30_receipt_kl  = 0        (was 86.3 → daily HSD receipt = "-")
 *  hsd_t40_receipt_kl  = 0        (was 9999999.999 corrupt)
 *  hsd_t30_lvl         = 89.8     (strapLookup => 18.9 kl HSD T30 stock)
 *  hsd_t40_lvl         = 85       (strapLookup => 5.9 kl HSD T40 stock)
 */
process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

// prev row (Jan-17 entry = Jan-17 DGR) values needed for zeroing deltas
const PREV_HFO_SUPPLY = 1008292400; // Jan-17 entry hfo_supply_int_rdg

async function main() {
  // curr row for Jan-18 DGR: entry_date = 2026-01-17T18:30 (IST = 2026-01-18)
  const res = await pool.query(
    `UPDATE taqa_daily_input SET
       hfo_receipt_mt         = 0,
       hfo_supply_int_rdg     = $2,
       hfo_t10_lvl_calc       = 675.5,
       lignite_conv_1a_int_rdg = 6258946,
       lignite_bunker_lvl     = 50.55,
       lignite_receipt_taqa_wb = 5515,
       lignite_lifted_nlcil_wb = 5519,
       hsd_t30_receipt_kl     = 0,
       hsd_t40_receipt_kl     = 0,
       hsd_t30_lvl            = 89.8,
       hsd_t40_lvl            = 85
     WHERE plant_id = $1 AND entry_date = '2026-01-18'
     RETURNING id, entry_date`,
    [PID, PREV_HFO_SUPPLY]
  );
  console.log('Patched Jan-18 fuel row:', res.rows);
  await pool.end();
  console.log('Done.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
