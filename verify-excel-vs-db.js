require('dotenv').config();
const path = require('path');
const { Pool } = require('pg');
const XLSX = require('xlsx');

// Simple numeric parser used across seed scripts
function parseNum(val) {
  if (!val && val !== 0) return 0;
  const str = String(val).split('/')[0].trim();
  const cleaned = str.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function excelDateToISO(val) {
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string' && val.includes('-')) {
    try {
      return new Date(val).toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
  return null;
}

function approxEqual(a, b, eps = 1e-3) {
  return Math.abs((a || 0) - (b || 0)) <= eps;
}

async function main() {
  const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: Number(process.env.DB_PORT || 5432),
  });

  const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
  console.log(`Reading workbook: ${filePath}`);

  const wb = XLSX.readFile(filePath);

  const faSheet = wb.Sheets['Fuel & Ash'];
  const waterSheet = wb.Sheets['Water'];
  if (!faSheet || !waterSheet) {
    console.error('Missing "Fuel & Ash" or "Water" sheets in workbook.');
    process.exit(1);
  }

  const faData = XLSX.utils.sheet_to_json(faSheet, { header: 1 });
  const waterData = XLSX.utils.sheet_to_json(waterSheet, { header: 1 });

  const { rows: plants } = await pool.query(
    `SELECT id FROM plants WHERE short_name = 'TTPP' OR short_name = 'TEST' LIMIT 1`
  );
  if (!plants.length) {
    console.error('No plant with short_name TTPP or TEST found.');
    process.exit(1);
  }
  const plantId = plants[0].id;
  console.log(`Using plant_id = ${plantId}`);

  // Index water rows by date for quick lookup
  const waterByDate = new Map();
  for (let r = 5; r < waterData.length; r++) {
    const row = waterData[r];
    if (!row || !row[0]) continue;
    const dateStr = excelDateToISO(row[0]);
    if (!dateStr) continue;
    if (new Date(dateStr) > new Date('2026-02-05')) break;
    waterByDate.set(dateStr, row);
  }

  let fuelMismatches = 0;
  let waterMismatches = 0;
  let datesChecked = 0;

  // Iterate over Fuel & Ash rows (dates) – same range as seed-fuel-history.js
  for (let r = 6; r < faData.length; r++) {
    const faRow = faData[r] || [];
    if (!faRow[0]) continue;

    const dateStr = excelDateToISO(faRow[0]);
    if (!dateStr) continue;
    if (new Date(dateStr) > new Date('2026-02-05')) break;

    datesChecked++;

    // ---- Fuel & Ash vs daily_fuel ---------------------------------
    // Excel values (same mapping as seed-fuel-history.js)
    const ldo_receipt_kl = parseNum(faRow[1]);
    const ldo_cons_kl = parseNum(faRow[7]);
    const ldo_stock_kl = parseNum(faRow[10]);

    const hfo_receipt_kl = parseNum(faRow[12]);
    const hfo_cons_kl = parseNum(faRow[18]);
    const hfo_stock_kl = parseNum(faRow[21]);

    const coal_receipt_mt = parseNum(faRow[25]);
    const coal_cons_mt = parseNum(faRow[28]);
    const coal_stock_mt = parseNum(faRow[31]);

    // Perf: GCV AR=1, GCV AF=5 – may be missing for some dates, ignore if zeros
    // We only compare when DB has non‑null values.

    const { rows: fuelRows } = await pool.query(
      `SELECT coal_receipt_mt, coal_cons_mt, coal_stock_mt,
              coal_gcv_ar, coal_gcv_af,
              ldo_receipt_kl, ldo_cons_kl, ldo_stock_kl,
              hfo_receipt_kl, hfo_cons_kl, hfo_stock_kl,
              soc_ml_kwh, h2_cons
       FROM daily_fuel
       WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, dateStr]
    );

    if (!fuelRows[0]) {
      console.warn(`[FUEL] Missing daily_fuel row for ${dateStr}`);
    } else {
      const f = fuelRows[0];
      function check(field, excelVal, dbVal) {
        if (!approxEqual(excelVal, dbVal)) {
          fuelMismatches++;
          const diff = (dbVal || 0) - (excelVal || 0);
          console.log(
            `[FUEL] ${dateStr} ${field} mismatch: Excel=${excelVal} DB=${dbVal} Δ=${diff}`
          );
        }
      }

      check('coal_receipt_mt', coal_receipt_mt, Number(f.coal_receipt_mt || 0));
      check('coal_cons_mt', coal_cons_mt, Number(f.coal_cons_mt || 0));
      check('coal_stock_mt', coal_stock_mt, Number(f.coal_stock_mt || 0));

      check('ldo_receipt_kl', ldo_receipt_kl, Number(f.ldo_receipt_kl || 0));
      check('ldo_cons_kl', ldo_cons_kl, Number(f.ldo_cons_kl || 0));
      check('ldo_stock_kl', ldo_stock_kl, Number(f.ldo_stock_kl || 0));

      check('hfo_receipt_kl', hfo_receipt_kl, Number(f.hfo_receipt_kl || 0));
      check('hfo_cons_kl', hfo_cons_kl, Number(f.hfo_cons_kl || 0));
      check('hfo_stock_kl', hfo_stock_kl, Number(f.hfo_stock_kl || 0));
    }

    // ---- Water vs daily_water ------------------------------------
    const waterRow = waterByDate.get(dateStr);
    if (!waterRow) {
      console.warn(`[WATER] No Water sheet row for ${dateStr}`);
      continue;
    }

    const dm_generation_m3 = parseNum(waterRow[1]);
    const dm_total_cons_m3 = parseNum(waterRow[4]);
    const dm_stock_m3 = parseNum(waterRow[7]);
    const dm_cycle_makeup_m3 = parseNum(waterRow[8]);
    const service_water_m3 = parseNum(waterRow[20]);
    const potable_water_m3 = parseNum(waterRow[56]);
    const sea_water_m3 = parseNum(waterRow[66]);

    const { rows: waterRowsDb } = await pool.query(
      `SELECT dm_generation_m3, dm_cycle_makeup_m3, dm_cycle_pct,
              dm_total_cons_m3, dm_stock_m3,
              service_water_m3, potable_water_m3, sea_water_m3
       FROM daily_water
       WHERE plant_id = $1 AND entry_date = $2`,
      [plantId, dateStr]
    );

    if (!waterRowsDb[0]) {
      console.warn(`[WATER] Missing daily_water row for ${dateStr}`);
    } else {
      const w = waterRowsDb[0];

      function wcheck(field, excelVal, dbVal) {
        if (!approxEqual(excelVal, dbVal)) {
          waterMismatches++;
          const diff = (dbVal || 0) - (excelVal || 0);
          console.log(
            `[WATER] ${dateStr} ${field} mismatch: Excel=${excelVal} DB=${dbVal} Δ=${diff}`
          );
        }
      }

      wcheck('dm_generation_m3', dm_generation_m3, Number(w.dm_generation_m3 || 0));
      wcheck('dm_total_cons_m3', dm_total_cons_m3, Number(w.dm_total_cons_m3 || 0));
      wcheck('dm_stock_m3', dm_stock_m3, Number(w.dm_stock_m3 || 0));
      wcheck('dm_cycle_makeup_m3', dm_cycle_makeup_m3, Number(w.dm_cycle_makeup_m3 || 0));
      wcheck('service_water_m3', service_water_m3, Number(w.service_water_m3 || 0));
      wcheck('potable_water_m3', potable_water_m3, Number(w.potable_water_m3 || 0));
      wcheck('sea_water_m3', sea_water_m3, Number(w.sea_water_m3 || 0));
    }
  }

  console.log('\n=== Verification Summary ===');
  console.log(`Dates checked (Fuel & Ash): ${datesChecked}`);
  console.log(`Fuel mismatches: ${fuelMismatches}`);
  console.log(`Water mismatches: ${waterMismatches}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

