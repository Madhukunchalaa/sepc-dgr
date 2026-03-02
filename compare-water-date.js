require('dotenv').config();
const path = require('path');
const { Pool } = require('pg');
const XLSX = require('xlsx');

function parseNum(val) {
  if (!val && val !== 0) return 0;
  const n = Number(String(val).toString().replace(/[^0-9.-]/g, ''));
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

async function main() {
  const targetDate = process.argv[2] || '2025-07-10';

  const pool = new Pool({
    user: process.env.DB_USER || 'dgr_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dgr_platform',
    password: process.env.DB_PASSWORD || '1234',
    port: Number(process.env.DB_PORT || 5432),
  });

  const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
  const wb = XLSX.readFile(filePath);
  const waterSheet = wb.Sheets['Water'];
  const dataWater = XLSX.utils.sheet_to_json(waterSheet, { header: 1 });

  let excelRow = null;
  for (let r = 5; r < dataWater.length; r++) {
    const row = dataWater[r];
    if (!row || !row[0]) continue;
    const iso = excelDateToISO(row[0]);
    if (iso === targetDate) {
      excelRow = row;
      break;
    }
  }

  if (!excelRow) {
    console.error('No Excel Water row found for', targetDate);
    process.exit(1);
  }

  const excel = {
    dm_generation_m3: parseNum(excelRow[1]),
    dm_total_cons_m3: parseNum(excelRow[4]),
    dm_stock_m3: parseNum(excelRow[7]),
    dm_cycle_makeup_m3: parseNum(excelRow[8]),
    service_water_m3: parseNum(excelRow[20]),
    potable_water_m3: parseNum(excelRow[56]),
    sea_water_m3: parseNum(excelRow[66]),
  };

  const { rows: plants } = await pool.query(
    `SELECT id FROM plants WHERE short_name='TTPP' OR short_name='TEST' LIMIT 1`
  );
  const plantId = plants[0].id;

  const { rows } = await pool.query(
    `SELECT dm_generation_m3, dm_cycle_makeup_m3, dm_cycle_pct,
            dm_total_cons_m3, dm_stock_m3,
            service_water_m3, potable_water_m3, sea_water_m3
     FROM daily_water
     WHERE plant_id=$1 AND entry_date=$2`,
    [plantId, targetDate]
  );

  const db = rows[0] || {};

  console.log('\nWater comparison for', targetDate);
  console.table([
    {
      field: 'dm_generation_m3',
      excel: excel.dm_generation_m3,
      db: Number(db.dm_generation_m3 || 0),
    },
    {
      field: 'dm_total_cons_m3',
      excel: excel.dm_total_cons_m3,
      db: Number(db.dm_total_cons_m3 || 0),
    },
    {
      field: 'dm_stock_m3',
      excel: excel.dm_stock_m3,
      db: Number(db.dm_stock_m3 || 0),
    },
    {
      field: 'dm_cycle_makeup_m3',
      excel: excel.dm_cycle_makeup_m3,
      db: Number(db.dm_cycle_makeup_m3 || 0),
    },
    {
      field: 'service_water_m3',
      excel: excel.service_water_m3,
      db: Number(db.service_water_m3 || 0),
    },
    {
      field: 'potable_water_m3',
      excel: excel.potable_water_m3,
      db: Number(db.potable_water_m3 || 0),
    },
    {
      field: 'sea_water_m3',
      excel: excel.sea_water_m3,
      db: Number(db.sea_water_m3 || 0),
    },
  ]);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

