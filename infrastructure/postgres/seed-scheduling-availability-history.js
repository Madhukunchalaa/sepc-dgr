const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'dgr_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dgr_platform',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

function parseNum(val) {
  if (!val && val !== 0) return 0;
  const n = Number(String(val).toString().replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excelDateToISO(v) {
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string' && v.includes('-')) {
    try {
      return new Date(v).toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
  return null;
}

async function run() {
  const filePath = path.join(__dirname, '../../_dev_scripts/excel_docs/DGR FY 2025-20261 - V1 (1).xlsx');
  console.log(`Reading ${filePath}...`);

  const wb = XLSX.readFile(filePath);

const dgrSheet = wb.Sheets['DGR'];
const sapSheet = wb.Sheets['SAP'];
const dgr = XLSX.utils.sheet_to_json(dgrSheet, { header: 1 });
const sap = XLSX.utils.sheet_to_json(sapSheet, { header: 1 });

  const { rows: plants } = await pool.query(
    `SELECT id FROM plants WHERE short_name = 'TTPP' OR short_name = 'TEST' LIMIT 1`
  );
  if (!plants.length) throw new Error('No plant found');
  const plantId = plants[0].id;
  console.log(`Using plant ${plantId}`);

  let schedCount = 0;
  let availCount = 0;

  // ── SCHEDULING HISTORY FROM SAP SHEET ──
  // SAP headers:
  // Col 0: DATE (serial)
  // Col 1: Power Generation (kWh)
  // Col 2: Export (kWh)
  // Col 3: Scrap (kWh)
  // Col 4: DC (kWhr)
  // Col 5: SG PPA (kWhr)
  // Col 6: SG URS (kWhr)
  // We map:
  //   dc_sepc_mu   = DC / 1e6
  //   dc_tnpdcl_mu = DC / 1e6  (same for this single-utility plant)
  //   sg_ppa_mu    = SG_PPA / 1e6
  //   sg_dam_mu    = 0 (Excel DAM is rarely used; keep 0 for history)
  //   sg_rtm_mu    = 0 (same)
  //   urs_dam_mwh  = SG_URS / 1000 (MWh)
  //   urs_rtm_mwh  = 0
  //   urs_revenue  = 0 (not available in SAP sheet)

  for (let r = 3; r < sap.length; r++) {
    const row = sap[r] || [];
    if (!row[0]) continue;
    const dateStr = excelDateToISO(row[0]);
    if (!dateStr) continue;
    if (new Date(dateStr) > new Date('2026-02-05')) break;

    const dcKwh = parseNum(row[4]);
    const sgPpaKwh = parseNum(row[5]);
    const sgUrsKwh = parseNum(row[6]);

    const dc_sepc_mu = dcKwh / 1_000_000;
    const dc_tnpdcl_mu = dcKwh / 1_000_000;
    const sg_ppa_mu = sgPpaKwh / 1_000_000;
    const sg_dam_mu = 0;
    const sg_rtm_mu = 0;
    const urs_dam_mwh = sgUrsKwh / 1000;
    const urs_rtm_mwh = 0;
    const urs_revenue = 0;

    await pool.query(
      `
        INSERT INTO daily_scheduling (
          plant_id, entry_date,
          dc_sepc_mu, dc_tnpdcl_mu, sg_ppa_mu, sg_dam_mu, sg_rtm_mu,
          urs_dam_mwh, urs_rtm_mwh, urs_revenue,
          status
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved'
        )
        ON CONFLICT (plant_id, entry_date) DO UPDATE SET
          dc_sepc_mu = EXCLUDED.dc_sepc_mu,
          dc_tnpdcl_mu = EXCLUDED.dc_tnpdcl_mu,
          sg_ppa_mu = EXCLUDED.sg_ppa_mu,
          sg_dam_mu = EXCLUDED.sg_dam_mu,
          sg_rtm_mu = EXCLUDED.sg_rtm_mu,
          urs_dam_mwh = EXCLUDED.urs_dam_mwh,
          urs_rtm_mwh = EXCLUDED.urs_rtm_mwh,
          urs_revenue = EXCLUDED.urs_revenue,
          status = 'approved',
          updated_at = NOW();
      `,
      [
        plantId,
        dateStr,
        dc_sepc_mu,
        dc_tnpdcl_mu,
        sg_ppa_mu,
        sg_dam_mu,
        sg_rtm_mu,
        urs_dam_mwh,
        urs_rtm_mwh,
        urs_revenue,
      ]
    );
    schedCount++;
  }

  // Availability history is not present in machine-readable form in this workbook;
  // leave `daily_availability` as manual entry for now.

  console.log(`Seeded scheduling rows: ${schedCount}, availability rows: ${availCount}`);

  await pool.end();
}

run().catch((err) => {
  console.error('Seeding scheduling/availability history failed:', err);
  process.exit(1);
});

