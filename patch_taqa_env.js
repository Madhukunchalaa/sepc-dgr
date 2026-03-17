/**
 * patch_taqa_env.js
 * Fix grid frequency, ambient temperature, and humidity DB values for 3 audit dates.
 * Previous DB data was shifted by one column (HLOOKUP off-by-1 data entry error).
 * Values from Excel 24cal sheet rows 140-145.
 */
process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PID = '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b';

const patches = [
  {
    date: '2025-08-19',
    // R140=50.21(GF max), R141=49.79(GF min), R142=36(AT max), R143=24(AT min), R144=84(RH max), R145=40(RH min)
    grid_freq_max:    50.21,
    grid_freq_min:    49.79,
    ambient_temp_max: 36,
    ambient_temp_min: 24,
    humidity_max:     84,
    humidity_min:     40,
  },
  {
    date: '2025-12-05',
    // R140=50.26, R141=49.69, R142=29.1, R143=23.8, R144=96, R145=76
    grid_freq_max:    50.26,
    grid_freq_min:    49.69,
    ambient_temp_max: 29.1,
    ambient_temp_min: 23.8,
    humidity_max:     96,
    humidity_min:     76,
  },
  {
    date: '2026-01-21',
    // R140=50.26, R141=49.82; R142-R145 = null in Excel (no ambient/humidity data)
    grid_freq_max:    50.26,
    grid_freq_min:    49.82,
    // ambient_temp and humidity not available in Excel for this date — leave unchanged
  },
];

async function main() {
  for (const { date, ...fields } of patches) {
    const keys = Object.keys(fields);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map(k => fields[k]);
    vals.push(PID, date);
    const sql = `UPDATE taqa_daily_input SET ${sets} WHERE plant_id = $${keys.length + 1} AND entry_date = $${keys.length + 2} RETURNING id`;
    const res = await pool.query(sql, vals);
    console.log(`${date}: updated ${res.rowCount} row(s) → fields: ${keys.join(', ')}`);
  }
  await pool.end();
  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
