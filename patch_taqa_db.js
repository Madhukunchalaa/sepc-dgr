process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

const patches = [
  {
    date: '2025-08-19',
    // T-1 (2025-08-18) values for delta reference:
    // potable=786399, cw_blowdown=4123779, borehole_res=20519449, borehole_cw=11403757, hfo_supply=986028900
    fields: {
      chem_ash_pct:            8.32,
      chem_gcv_nlcil:          2580,
      chem_ubc_bottom_ash:     7.976666667,
      chem_ubc_fly_ash:        0.583333333,
      fa_silo_lvl_pct:         42,
      schedule_gen_mldc:       4423.12,
      dm_water_prod_m3:        14337.166816,   // g(63) total plant water
      lignite_receipt_taqa_wb: 4750.26,         // Excel R17 actual receipt
      lignite_lifted_nlcil_wb: 4988.34,         // Excel R15 NLC lifted
      hfo_receipt_mt:          0,
      hfo_supply_int_rdg:      986028900,        // =T-1 → delta=0 → HFO=0
      potable_tank_makeup:     789361,           // T-1(786399)+2962 → seal water=2962
      cw_blowdown:             4124036.21,       // T-1(4123779)+257.21 → rate=257.21
      borewell_to_cw_forebay:  11409930,         // T-1(11403757)+6173 → CW blow=6173
      borewell_to_reservoir:   20519449,         // =T-1 → delta=0
      ash_pond_overflow:       2018,
    }
  },
  {
    date: '2025-12-05',
    // T-1 (2025-12-04): potable=808800, cw_blowdown=4384122, borehole_res=20520967, borehole_cw=12622823, hfo_supply=1003109100
    fields: {
      chem_ash_pct:            6.63,
      chem_gcv_nlcil:          2583,
      chem_ubc_bottom_ash:     8.48,
      chem_ubc_fly_ash:        0.463333333,
      fa_silo_lvl_pct:         25,
      schedule_gen_mldc:       4995,
      dm_water_prod_m3:        12379.938133,
      lignite_receipt_taqa_wb: 7116.72,
      lignite_lifted_nlcil_wb: 7138.83,
      hfo_receipt_mt:          0,
      hfo_supply_int_rdg:      1003109100,       // =T-1 → delta=0 → HFO=0
      potable_tank_makeup:     812056,           // T-1(808800)+3256
      cw_blowdown:             4384418.08,       // T-1(4384122)+296.08
      borewell_to_cw_forebay:  12629929,         // T-1(12622823)+7106
      borewell_to_reservoir:   20520967,         // =T-1 → delta=0
      ash_pond_overflow:       5920,
    }
  },
  {
    date: '2026-01-21',
    // T-1 (2026-01-20): potable=818656.40, cw_blowdown=4621622, borehole_res=20523930, borehole_cw=13042070, hfo_supply=1008367300
    fields: {
      chem_ash_pct:            7.14,
      chem_gcv_nlcil:          2484,
      chem_ubc_bottom_ash:     12.7,
      chem_ubc_fly_ash:        0.21,
      fa_silo_lvl_pct:         40,
      schedule_gen_mldc:       4291.88,
      dm_water_prod_m3:        12757.940190,
      lignite_receipt_taqa_wb: 5576.11,
      lignite_lifted_nlcil_wb: 5581.19,
      hfo_receipt_mt:          0,
      hfo_supply_int_rdg:      1008414210,       // T-1(1008367300)+46910 → HFO=44.33 MT
      potable_tank_makeup:     822037.40,        // T-1(818656.40)+3381
      cw_blowdown:             4621922.42,       // T-1(4621622)+300.42
      borewell_to_cw_forebay:  13049280,         // T-1(13042070)+7210
      borewell_to_reservoir:   20523930,         // =T-1 → delta=0
      ash_pond_overflow:       4138,
    }
  }
];

async function main() {
  for (const { date, fields } of patches) {
    const keys = Object.keys(fields);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map(k => fields[k]);
    vals.push(PID, date);
    const sql = `UPDATE taqa_daily_input SET ${sets} WHERE plant_id = $${keys.length + 1} AND entry_date = $${keys.length + 2} RETURNING id`;
    const res = await pool.query(sql, vals);
    console.log(`${date}: updated ${res.rowCount} row(s)`);
  }
  await pool.end();
  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
