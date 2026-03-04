require('dotenv').config({ path: '../../.env' });
process.env.SERVICE_NAME = 'dgr-compute';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const ExcelJS = require('exceljs');
const logger = require('./shared/logger');
const { error, success } = require('./shared/response');
const { query } = require('./shared/db');
const { assembleDGR, assembleFleetSummary } = require('./engines/dgr.engine');
const { authenticate, requirePlantAccess } = require('./middleware/auth.middleware');

// Temporary auto-migrate missing tables
async function ensureTablesExist() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS daily_ash (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        plant_id            UUID NOT NULL REFERENCES plants(id),
        entry_date          DATE NOT NULL,
        fa_to_user_mt       DECIMAL(12,3),
        fa_to_dyke_mt       DECIMAL(12,3),
        ba_to_user_mt       DECIMAL(12,3),
        ba_to_dyke_mt       DECIMAL(12,3),
        fa_generated_mt     DECIMAL(12,3),
        ba_generated_mt     DECIMAL(12,3),
        fa_silo_mt          DECIMAL(12,3),
        ba_silo_mt          DECIMAL(12,3),
        submitted_by        UUID REFERENCES users(id),
        status              VARCHAR(20) DEFAULT 'draft',
        submitted_at        TIMESTAMPTZ,
        approved_at         TIMESTAMPTZ,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(plant_id, entry_date)
      );

      CREATE TABLE IF NOT EXISTS daily_dsm (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        plant_id              UUID NOT NULL REFERENCES plants(id),
        entry_date            DATE NOT NULL,
        dsm_net_profit_lacs   DECIMAL(14,2),
        dsm_payable_lacs      DECIMAL(14,2),
        dsm_receivable_lacs   DECIMAL(14,2),
        dsm_coal_saving_lacs  DECIMAL(14,2),
        submitted_by          UUID REFERENCES users(id),
        status                VARCHAR(20) DEFAULT 'draft',
        submitted_at          TIMESTAMPTZ,
        approved_at           TIMESTAMPTZ,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(plant_id, entry_date)
      );

      CREATE INDEX IF NOT EXISTS idx_daily_ash_plant_date ON daily_ash(plant_id, entry_date DESC);
      CREATE INDEX IF NOT EXISTS idx_daily_dsm_plant_date ON daily_dsm(plant_id, entry_date DESC);

      ALTER TABLE daily_water ADD COLUMN IF NOT EXISTS swi_flow_m3 DECIMAL(12,3);
      ALTER TABLE daily_water ADD COLUMN IF NOT EXISTS outfall_m3 DECIMAL(12,3);
      ALTER TABLE daily_water ADD COLUMN IF NOT EXISTS idct_makeup_m3 DECIMAL(12,3);
      ALTER TABLE daily_water ADD COLUMN IF NOT EXISTS filtered_water_gen_m3 DECIMAL(12,3);
      ALTER TABLE daily_water ADD COLUMN IF NOT EXISTS service_water_stock_m3 DECIMAL(12,3);
      
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS urs_net_profit_lacs DECIMAL(14,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS dc_loss_reasons JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS asking_rate_mw DECIMAL(10,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS deemed_gen_mu DECIMAL(12,6);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_coal_mu DECIMAL(10,4);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_coal_pct DECIMAL(6,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_cre_smps_mu DECIMAL(10,4);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_cre_smps_pct DECIMAL(6,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_bunker_mu DECIMAL(10,4);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_bunker_pct DECIMAL(6,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_aoh_mu DECIMAL(10,4);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_aoh_pct DECIMAL(6,2);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_vacuum_mu DECIMAL(10,4);
      ALTER TABLE daily_scheduling ADD COLUMN IF NOT EXISTS loss_vacuum_pct DECIMAL(6,2);

      ALTER TABLE daily_power ADD COLUMN IF NOT EXISTS partial_loading_pct DECIMAL(6,3);
      ALTER TABLE daily_performance ADD COLUMN IF NOT EXISTS ghr_remarks TEXT;
    `);
    logger.info('Auto-migrate: ensure missing tables and columns exist in Railway DB');
    return { success: true, message: 'Migration completed' };
  } catch (err) {
    logger.error('Auto-migrate failed', { error: err.message });
    return { success: false, message: err.message, stack: err.stack };
  }
}
ensureTablesExist();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || process.env.DGR_COMPUTE_SERVICE_PORT || 3004;

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); cb(new Error('CORS')); },
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'dgr-compute', status: 'ok', uptime: process.uptime() }));

// Admin manual migration trigger
app.get('/api/dgr/admin/migrate', async (req, res) => {
  const result = await ensureTablesExist();
  res.json(result);
});

// GET /api/dgr/:plantId/history?from=&to=
app.get('/api/dgr/:plantId/history', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const { from, to } = req.query;
    const { rows } = await query(
      `SELECT entry_date, generation_mu, avg_load_mw, plf_daily, apc_pct, export_mu
       FROM daily_power
       WHERE plant_id = $1
         AND ($2::date IS NULL OR entry_date >= $2::date)
         AND ($3::date IS NULL OR entry_date <= $3::date)
         AND status IN ('submitted','approved','locked')
       ORDER BY entry_date`,
      [req.params.plantId, from || null, to || null]
    );
    return success(res, { history: rows });
  } catch (err) {
    logger.error('History fetch error', { message: err.message });
    return error(res, 'Failed to fetch history', 500);
  }
});

// GET /api/dgr/:plantId/:date — Full DGR for a date
app.get('/api/dgr/:plantId/:date', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const dgr = await assembleDGR(req.params.plantId, req.params.date);
    return success(res, dgr);
  } catch (err) {
    logger.error('DGR compute error', { message: err.message, stack: err.stack });
    return error(res, `Failed to compute DGR: ${err.message}`, 500);
  }
});

// GET /api/dgr/fleet/:date — HQ fleet summary
app.get('/api/dgr/fleet/:date', authenticate, async (req, res) => {
  try {
    if (!['hq_management', 'it_admin'].includes(req.user.role)) {
      return error(res, 'Fleet view requires HQ Management role', 403);
    }
    const summary = await assembleFleetSummary(req.params.date);
    return success(res, summary);
  } catch (err) {
    logger.error('Fleet summary error', { message: err.message });
    return error(res, 'Failed to compute fleet summary', 500);
  }
});

// (Moved up)

// ─────────────────────────────────────────────────────────────────────────
// REPORTS: GET /api/reports/dgr/excel/:plantId/:date  → download .xlsx
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/reports/dgr/excel/:plantId/:date', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const dgr = await assembleDGR(plantId, date);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'DGR Platform';
    wb.created = new Date();

    const ws = wb.addWorksheet('DGR', { pageSetup: { orientation: 'landscape' } });

    // Column widths
    ws.columns = [
      { width: 40 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    // ── Styles ──────────────────────────────────────────────────────────────
    const hdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    const secFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    const subFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    const hdrFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const secFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    const subFont = { bold: true, color: { argb: 'FF1F3864' }, size: 10 };
    const bodyFont = { size: 10 };
    const border = { style: 'thin', color: { argb: 'FFAAAAAA' } };
    const allBorder = { top: border, left: border, bottom: border, right: border };

    function addRow(cols, fill, font, align = 'left') {
      const row = ws.addRow(cols);
      row.eachCell({ includeEmpty: true }, (cell, i) => {
        if (fill) cell.fill = fill;
        cell.font = font || bodyFont;
        cell.border = allBorder;
        cell.alignment = { vertical: 'middle', horizontal: i === 1 ? align : 'center', wrapText: true };
      });
      row.height = 18;
      return row;
    }

    function fmt(v, dec = 3) {
      if (v === null || v === undefined) return '-';
      const n = Number(v);
      return isNaN(n) ? v : n.toFixed(dec);
    }

    // -- Title Block (addRow first, then style)
    const titleRow = ws.addRow(['DAILY GENERATION REPORT - ' + (dgr.header?.fyLabel || '')]);
    ws.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
    titleRow.height = 24;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = hdrFill;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const subRow = ws.addRow([`${dgr.header?.plantName || ''}   |   Date: ${date}   |   ${dgr.header?.dayName || ''}, ${dgr.header?.monthYear || ''}`]);
    ws.mergeCells(`A${subRow.number}:E${subRow.number}`);
    subRow.height = 18;
    const subCell = subRow.getCell(1);
    subCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    subCell.fill = hdrFill;
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.addRow([]);  // blank spacer

    // ── Column Headers ────────────────────────────────────────────────────
    addRow(['Parameter', 'Unit', 'Daily', 'MTD', 'YTD'], secFill, secFont, 'center');

    // -- Helper: section heading (addRow first, then merge)
    function secHead(label) {
      const r = ws.addRow([label]);
      ws.mergeCells(`A${r.number}:E${r.number}`);
      r.getCell(1).fill = subFill;
      r.getCell(1).font = subFont;
      r.getCell(1).border = allBorder;
      r.getCell(1).alignment = { vertical: 'middle' };
      r.height = 16;
    }

    function dataRow(label, unit, daily, mtd, ytd, dec = 3) {
      addRow([label, unit, fmt(daily, dec), fmt(mtd, dec), fmt(ytd, dec)]);
    }

    function findVal(sectionTitle, exactRowLabel, format = 'daily') {
      const sec = dgr.sections?.find(s => s.title.includes(sectionTitle));
      if (!sec) return null;
      const row = sec.rows.find(r => r.particulars.toLowerCase() === exactRowLabel.toLowerCase());
      if (!row) return null;
      return row[format];
    }

    // ── SECTION 1: POWER ─────────────────────────────────────────────────
    secHead('POWER GENERATION');
    dataRow('Power Generation', 'MU', findVal('POWER', 'Power Generation', 'daily'), findVal('POWER', 'Power Generation', 'mtd'), findVal('POWER', 'Power Generation', 'ytd'));
    dataRow('Average Generation', 'MW', findVal('POWER', 'Average Power Generation', 'daily'), findVal('POWER', 'Average Power Generation', 'mtd'), findVal('POWER', 'Average Power Generation', 'ytd'));
    dataRow('Total Export (GT)', 'MU', findVal('POWER', 'Total Export (GT)', 'daily'), findVal('POWER', 'Total Export (GT)', 'mtd'), findVal('POWER', 'Total Export (GT)', 'ytd'));
    dataRow('Total Import (GT)', 'MU', findVal('POWER', 'Total Import (GT)', 'daily'), findVal('POWER', 'Total Import (GT)', 'mtd'), findVal('POWER', 'Total Import (GT)', 'ytd'));
    dataRow('Net Export (GT Export - GT Import)', 'MU', findVal('POWER', 'Net Export (GT Export - GT Import)', 'daily'), findVal('POWER', 'Net Export (GT Export - GT Import)', 'mtd'), findVal('POWER', 'Net Export (GT Export - GT Import)', 'ytd'));
    dataRow('Auxiliary Power Consumption (APC incl Import)', 'MU', findVal('POWER', 'Auxiliary Power Consumption (APC incl Import)', 'daily'), findVal('POWER', 'Auxiliary Power Consumption (APC incl Import)', 'mtd'), findVal('POWER', 'Auxiliary Power Consumption (APC incl Import)', 'ytd'));
    dataRow('APC %', '%', findVal('POWER', 'APC %', 'daily'), findVal('POWER', 'APC %', 'mtd'), findVal('POWER', 'APC %', 'ytd'), 4);
    dataRow('Hours on Grid', 'Hrs', findVal('POWER', 'Hours on Grid', 'daily'), '-', '-', 1);
    dataRow('Grid Frequency', 'Hz', findVal('POWER', 'Grid Frequency', 'daily'), '-', '-', 3);

    // ── SECTION 2: PERFORMANCE ────────────────────────────────────────────
    secHead('PERFORMANCE');
    dataRow('Plant Load Factor', '%', findVal('PERFORMANCE', 'Plant Load Factor', 'daily'), findVal('PERFORMANCE', 'Plant Load Factor', 'mtd'), findVal('PERFORMANCE', 'Plant Load Factor', 'ytd'), 4);
    dataRow('Partial Loading', '%', findVal('PERFORMANCE', 'Partial Loading', 'daily'), findVal('PERFORMANCE', 'Partial Loading', 'mtd'), findVal('PERFORMANCE', 'Partial Loading', 'ytd'), 4);
    dataRow('Plant Availability Factor (SEPC)', '%', findVal('PERFORMANCE', 'Plant Availability Factor (SEPC)', 'daily'), findVal('PERFORMANCE', 'Plant Availability Factor (SEPC)', 'mtd'), findVal('PERFORMANCE', 'Plant Availability Factor (SEPC)', 'ytd'), 4);
    dataRow('Plant Availability Factor (TNPDCL)', '%', findVal('PERFORMANCE', 'Plant Availability Factor (TNPDCL)', 'daily'), findVal('PERFORMANCE', 'Plant Availability Factor (TNPDCL)', 'mtd'), findVal('PERFORMANCE', 'Plant Availability Factor (TNPDCL)', 'ytd'), 4);
    dataRow('Plant Outage (Forced)', 'Count', findVal('PERFORMANCE', 'Plant Outage (Forced)', 'daily'), findVal('PERFORMANCE', 'Plant Outage (Forced)', 'mtd'), findVal('PERFORMANCE', 'Plant Outage (Forced)', 'ytd'), 0);
    dataRow('Plant Outage (Planned)', 'Count', findVal('PERFORMANCE', 'Plant Outage (Planned)', 'daily'), findVal('PERFORMANCE', 'Plant Outage (Planned)', 'mtd'), findVal('PERFORMANCE', 'Plant Outage (Planned)', 'ytd'), 0);
    dataRow('Plant Outage (RSD)', 'Count', findVal('PERFORMANCE', 'Plant Outage (RSD)', 'daily'), findVal('PERFORMANCE', 'Plant Outage (RSD)', 'mtd'), findVal('PERFORMANCE', 'Plant Outage (RSD)', 'ytd'), 0);
    dataRow('Specific Oil Consumption', 'ml/kWh', findVal('PERFORMANCE', 'Specific Oil Consumption', 'daily'), findVal('PERFORMANCE', 'Specific Oil Consumption', 'mtd'), findVal('PERFORMANCE', 'Specific Oil Consumption', 'ytd'), 5);
    dataRow('Specific Coal Consumption', 'kg/kWh', findVal('PERFORMANCE', 'Specific Coal Consumption', 'daily'), findVal('PERFORMANCE', 'Specific Coal Consumption', 'mtd'), findVal('PERFORMANCE', 'Specific Coal Consumption', 'ytd'), 5);
    dataRow('GHR (As Fired)', 'kCal/kWh', findVal('PERFORMANCE', 'GHR (As Fired)', 'daily'), findVal('PERFORMANCE', 'GHR (As Fired)', 'mtd'), findVal('PERFORMANCE', 'GHR (As Fired)', 'ytd'), 2);
    dataRow('GCV (As Fired)', 'kCal/kg', findVal('PERFORMANCE', 'GCV (As Fired)', 'daily'), findVal('PERFORMANCE', 'GCV (As Fired)', 'mtd'), findVal('PERFORMANCE', 'GCV (As Fired)', 'ytd'), 0);

    // ── SECTION 3: CONSUMPTION & STOCK ───────────────────────────────────
    secHead('FUEL CONSUMPTION & STOCK');
    dataRow('Coal Receipt', 'MT', findVal('CONSUMPTION', 'Coal Receipt', 'daily'), findVal('CONSUMPTION', 'Coal Receipt', 'mtd'), findVal('CONSUMPTION', 'Coal Receipt', 'ytd'), 2);
    dataRow('Coal Consumption', 'MT', findVal('CONSUMPTION', 'Coal Consumption', 'daily'), findVal('CONSUMPTION', 'Coal Consumption', 'mtd'), findVal('CONSUMPTION', 'Coal Consumption', 'ytd'), 2);
    dataRow('Coal Stock (Day End)', 'MT', findVal('CONSUMPTION', 'Coal Stock (Day End)', 'daily'), '-', '-', 2);
    dataRow('LDO Receipt', 'KL', findVal('CONSUMPTION', 'LDO Receipt', 'daily'), findVal('CONSUMPTION', 'LDO Receipt', 'mtd'), findVal('CONSUMPTION', 'LDO Receipt', 'ytd'), 2);
    dataRow('LDO Consumption', 'KL', findVal('CONSUMPTION', 'LDO Consumption', 'daily'), findVal('CONSUMPTION', 'LDO Consumption', 'mtd'), findVal('CONSUMPTION', 'LDO Consumption', 'ytd'), 2);
    dataRow('LDO Stock (Day End)', 'KL', findVal('CONSUMPTION', 'LDO Stock (Day End)', 'daily'), '-', '-', 2);
    dataRow('HFO Receipt', 'KL', findVal('CONSUMPTION', 'HFO Receipt', 'daily'), findVal('CONSUMPTION', 'HFO Receipt', 'mtd'), findVal('CONSUMPTION', 'HFO Receipt', 'ytd'), 2);
    dataRow('HFO Consumption', 'KL', findVal('CONSUMPTION', 'HFO Consumption', 'daily'), findVal('CONSUMPTION', 'HFO Consumption', 'mtd'), findVal('CONSUMPTION', 'HFO Consumption', 'ytd'), 2);
    dataRow('HFO Stock (Day End)', 'KL', findVal('CONSUMPTION', 'HFO Stock (Day End)', 'daily'), '-', '-', 2);
    dataRow('H₂ Consumption', 'Nos', findVal('CONSUMPTION', 'H2 Cylinder Consumption', 'daily'), '-', '-', 0);
    dataRow('H₂ Stock', 'Nos', findVal('CONSUMPTION', 'H2 Cylinder Stock', 'daily'), '-', '-', 0);
    dataRow('CO₂ Consumption', 'Nos', findVal('CONSUMPTION', 'CO2 Cylinder Consumption', 'daily'), '-', '-', 0);
    dataRow('CO₂ Stock', 'Nos', findVal('CONSUMPTION', 'CO2 Cylinder Stock', 'daily'), '-', '-', 0);
    dataRow('N₂ Consumption', 'Nos', findVal('CONSUMPTION', 'N2 Cylinder Consumption', 'daily'), '-', '-', 0);
    dataRow('N₂ Stock', 'Nos', findVal('CONSUMPTION', 'N2 Cylinder Stock', 'daily'), '-', '-', 0);

    secHead('WATER');
    dataRow('DM Water Generation', 'm³', findVal('WATER', 'DM Water Generation', 'daily'), findVal('WATER', 'DM Water Generation', 'mtd'), findVal('WATER', 'DM Water Generation', 'ytd'), 2);
    dataRow('DM Water Cycle Makeup', 'm³', findVal('WATER', 'DM Water Cycle Makeup', 'daily'), findVal('WATER', 'DM Water Cycle Makeup', 'mtd'), findVal('WATER', 'DM Water Cycle Makeup', 'ytd'), 2);
    dataRow('DM Water Total Consumption', 'm³', findVal('WATER', 'DM Total Consumption', 'daily'), findVal('WATER', 'DM Total Consumption', 'mtd'), findVal('WATER', 'DM Total Consumption', 'ytd'), 2);
    dataRow('DM Cycle Pct', '%', findVal('WATER', 'DM Cycle Pct', 'daily'), findVal('WATER', 'DM Cycle Pct', 'mtd'), findVal('WATER', 'DM Cycle Pct', 'ytd'), 4);
    dataRow('DM Water Total / Usable Stock', 'm³', findVal('WATER', 'DM Water Total / Usable Stock', 'daily'), '-', '-', 2);
    dataRow('Service Water Consumption', 'm³', findVal('WATER', 'Service Water Consumption', 'daily'), findVal('WATER', 'Service Water Consumption', 'mtd'), findVal('WATER', 'Service Water Consumption', 'ytd'), 2);
    dataRow('Potable Water Consumption', 'm³', findVal('WATER', 'Potable Water Consumption', 'daily'), findVal('WATER', 'Potable Water Consumption', 'mtd'), findVal('WATER', 'Potable Water Consumption', 'ytd'), 2);
    dataRow('Sea Water Consumption', 'm³', findVal('WATER', 'Sea Water Consumption', 'daily'), findVal('WATER', 'Sea Water Consumption', 'mtd'), findVal('WATER', 'Sea Water Consumption', 'ytd'), 2);
    dataRow('SWI Flow', 'm³', findVal('WATER', 'SWI Flow', 'daily'), findVal('WATER', 'SWI Flow', 'mtd'), findVal('WATER', 'SWI Flow', 'ytd'), 2);
    dataRow('Outfall (CT Blowdown & WTP Reject)', 'm³', findVal('WATER', 'Outfall (CT Blowdown & WTP Reject)', 'daily'), findVal('WATER', 'Outfall (CT Blowdown & WTP Reject)', 'mtd'), findVal('WATER', 'Outfall (CT Blowdown & WTP Reject)', 'ytd'), 2);

    // ── SECTION 4: SCHEDULING ─────────────────────────────────────────────
    secHead('POWER SCHEDULE');
    dataRow('Declared Capacity (SEPC)', 'MU', findVal('SCHEDULE', 'Declared Capacity (SEPC)'), findVal('SCHEDULE', 'Declared Capacity (SEPC)', 'mtd'), findVal('SCHEDULE', 'Declared Capacity (SEPC)', 'ytd'));
    dataRow('Declared Capacity (TNPDCL)', 'MU', findVal('SCHEDULE', 'Declared Capacity (TNPDCL)'), findVal('SCHEDULE', 'Declared Capacity (TNPDCL)', 'mtd'), findVal('SCHEDULE', 'Declared Capacity (TNPDCL)', 'ytd'));
    dataRow('Schedule Generation (PPA)', 'MU', findVal('SCHEDULE', 'Schedule Generation (SG – PPA)'), findVal('SCHEDULE', 'Schedule Generation (SG – PPA)', 'mtd'), findVal('SCHEDULE', 'Schedule Generation (SG – PPA)', 'ytd'));
    dataRow('Schedule Generation (DAM)', 'MU', findVal('SCHEDULE', 'Schedule Generation (SG – DAM)'), findVal('SCHEDULE', 'Schedule Generation (SG – DAM)', 'mtd'), findVal('SCHEDULE', 'Schedule Generation (SG – DAM)', 'ytd'));
    dataRow('Schedule Generation (RTM)', 'MU', findVal('SCHEDULE', 'Schedule Generation (SG – RTM)'), findVal('SCHEDULE', 'Schedule Generation (SG – RTM)', 'mtd'), findVal('SCHEDULE', 'Schedule Generation (SG – RTM)', 'ytd'));
    dataRow('Asking Rate to Achieve 80% DC', 'MW', findVal('SCHEDULE', 'Asking Rate to Achieve 80% DC'), '-', '-', 2);
    dataRow('Deemed Generation – DG (TB + RSD)', 'MU', findVal('SCHEDULE', 'Deemed Generation – DG (TB + RSD)'), '-', '-', 2);

    secHead('DC LOSS B/U (Capacity – DC TNPDCL)');
    dataRow('Coal Shortage', 'MU / %', findVal('DC LOSS', 'Coal Shortage'), '-', '-', 2);
    dataRow('CRE to SMPS Failure Trip', 'MU / %', findVal('DC LOSS', 'CRE to SMPS Failure Trip'), '-', '-', 2);
    dataRow('Bunker Choke', 'MU / %', findVal('DC LOSS', 'Bunker Choke'), '-', '-', 2);
    dataRow('AOH', 'MU / %', findVal('DC LOSS', 'AOH'), '-', '-', 2);
    dataRow('Low Vacuum Trip', 'MU / %', findVal('DC LOSS', 'Low Vacuum Trip'), '-', '-', 2);

    // ── SECTION 5: ASH ───────────────────────────────────────────────────
    secHead('ASH');
    dataRow('Fly Ash to User', 'MT', findVal('ASH', 'Fly Ash to User'), findVal('ASH', 'Fly Ash to User', 'mtd'), findVal('ASH', 'Fly Ash to User', 'ytd'), 3);
    dataRow('Fly Ash to Dyke / Internal', 'MT', findVal('ASH', 'Fly Ash to Dyke / Internal'), findVal('ASH', 'Fly Ash to Dyke / Internal', 'mtd'), findVal('ASH', 'Fly Ash to Dyke / Internal', 'ytd'), 3);
    dataRow('Bottom Ash to User', 'MT', findVal('ASH', 'Bottom Ash to User'), findVal('ASH', 'Bottom Ash to User', 'mtd'), findVal('ASH', 'Bottom Ash to User', 'ytd'), 3);
    dataRow('Bottom Ash to Dyke / Internal', 'MT', findVal('ASH', 'Bottom Ash to Dyke / Internal'), findVal('ASH', 'Bottom Ash to Dyke / Internal', 'mtd'), findVal('ASH', 'Bottom Ash to Dyke / Internal', 'ytd'), 3);
    dataRow('Fly Ash Generated', 'MT', findVal('ASH', 'Fly Ash Generated'), findVal('ASH', 'Fly Ash Generated', 'mtd'), findVal('ASH', 'Fly Ash Generated', 'ytd'), 3);
    dataRow('Bottom & Eco Ash Generated', 'MT', findVal('ASH', 'Bottom & Eco Ash Generated'), findVal('ASH', 'Bottom & Eco Ash Generated', 'mtd'), findVal('ASH', 'Bottom & Eco Ash Generated', 'ytd'), 3);
    dataRow('Fly Ash in Silo', 'MT', findVal('ASH', 'Fly Ash in Silo'), '-', '-', 3);
    dataRow('Bottom Ash in Silo', 'MT', findVal('ASH', 'Bottom Ash in Silo'), '-', '-', 3);

    // ── SECTION 6: DSM & URS ─────────────────────────────────────────────
    secHead('DSM & URS');
    dataRow('DSM Net Profit', 'Lacs', findVal('DSM', 'DSM Net Profit'), '-', findVal('DSM', 'DSM Net Profit', 'ytd'), 2);
    dataRow('DSM Payable by SEPC', 'Lacs', findVal('DSM', 'DSM Payable by SEPC'), '-', findVal('DSM', 'DSM Payable by SEPC', 'ytd'), 2);
    dataRow('DSM Receivable by SEPC', 'Lacs', findVal('DSM', 'DSM Receivable by SEPC'), '-', findVal('DSM', 'DSM Receivable by SEPC', 'ytd'), 2);
    dataRow('DSM Coal Saving (+)/Lost (-) by SEPC', 'Lacs', findVal('DSM', 'DSM Coal Saving / (+Loss) by SEPC'), '-', findVal('DSM', 'DSM Coal Saving / (+Loss) by SEPC', 'ytd'), 2);
    dataRow('URS Net Profit', 'Lacs', findVal('URS', 'URS Net Profit'), '-', findVal('URS', 'URS Net Profit', 'ytd'), 2);

    // ── Stream the file ───────────────────────────────────────────────────
    // Sanitize to ASCII-only for Content-Disposition header (no dashes, special chars)
    const plantShort = (dgr.header?.plantName || 'PLANT')
      .replace(/[^\w\s-]/g, '')   // strip non-word chars
      .replace(/\s+/g, '_')
      .replace(/[^\x20-\x7E]/g, '') // strip any remaining non-ASCII
      .substring(0, 30)
      .trim() || 'PLANT';
    const filename = `DGR_${plantShort}_${date}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    logger.error('Excel download error', { message: err.message, stack: err.stack });
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate Excel report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// REPORTS: GET /api/reports/sap/:plantId/:date  → SAP JSON export
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/reports/sap/:plantId/:date', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const dgr = await assembleDGR(plantId, date);
    const payload = {
      exportDate: new Date().toISOString(),
      reportDate: date,
      plantId,
      plantName: dgr.header?.plantName,
      generationMU: dgr.power?.generation?.daily,
      exportMU: dgr.power?.exportGT?.daily,
      importMU: dgr.power?.importGT?.daily,
      apcMU: dgr.power?.apc?.daily,
      apcPct: dgr.power?.apc?.pct?.daily,
      plfDaily: dgr.performance?.plf?.daily,
      sccKgKwh: dgr.performance?.scc?.daily,
      socMlKwh: dgr.performance?.soc?.daily,
      ghrKcalKwh: dgr.performance?.ghr?.daily,
      coalConsMt: dgr.consumptionStock?.coalConsumption?.daily,
      coalStockMt: dgr.consumptionStock?.coalStock?.daily,
      ldoConsKl: dgr.consumptionStock?.ldoConsumption?.daily,
      hfoConsKl: dgr.consumptionStock?.hfoConsumption?.daily,
    };
    res.setHeader('Content-Disposition', `attachment; filename="SAP_${date}.json"`);
    res.json(payload);
  } catch (err) {
    logger.error('SAP export error', { message: err.message });
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate SAP export' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message });
  error(res, 'Internal server error', 500);
});

app.listen(PORT, () => logger.info(`DGR Compute Service running on port ${PORT}`));
module.exports = app;
