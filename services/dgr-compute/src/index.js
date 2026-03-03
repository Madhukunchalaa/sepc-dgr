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

const app = express();
const PORT = process.env.DGR_COMPUTE_SERVICE_PORT || 3004;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'dgr-compute', status: 'ok', uptime: process.uptime() }));

// GET /api/dgr/:plantId/:date — Full DGR for a date
app.get('/api/dgr/:plantId/:date', authenticate, requirePlantAccess, async (req, res) => {
  try {
    const dgr = await assembleDGR(req.params.plantId, req.params.date);
    return success(res, dgr);
  } catch (err) {
    logger.error('DGR compute error', { message: err.message });
    return error(res, 'Failed to compute DGR', 500);
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
    return error(res, 'Failed to fetch history', 500);
  }
});

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

    // ── SECTION 1: POWER ─────────────────────────────────────────────────
    secHead('POWER GENERATION');
    const p = dgr.power || {};
    dataRow('Power Generation', 'MU', p.generation?.daily, p.generation?.mtd, p.generation?.ytd);
    dataRow('Average Generation', 'MW', p.avgLoad?.daily, p.avgLoad?.mtd, p.avgLoad?.ytd);
    dataRow('Total Export (GT)', 'MU', p.exportGT?.daily, p.exportGT?.mtd, p.exportGT?.ytd);
    dataRow('Total Import (GT)', 'MU', p.importGT?.daily, p.importGT?.mtd, p.importGT?.ytd);
    dataRow('APC (incl. Import)', 'MU', p.apc?.daily, p.apc?.mtd, p.apc?.ytd);
    dataRow('APC %', '%', p.apc?.pct?.daily, p.apc?.pct?.mtd, p.apc?.pct?.ytd, 4);
    dataRow('Hours on Grid', 'Hrs', p.hoursOnGrid?.daily, '-', '-', 1);
    dataRow('Grid Frequency Min', 'Hz', p.gridFrequency?.min, '-', '-', 3);
    dataRow('Grid Frequency Max', 'Hz', p.gridFrequency?.max, '-', '-', 3);
    dataRow('Grid Frequency Avg', 'Hz', p.gridFrequency?.avg, '-', '-', 3);

    // ── SECTION 2: PERFORMANCE ────────────────────────────────────────────
    secHead('PERFORMANCE');
    const pf = dgr.performance || {};
    dataRow('Plant Load Factor (PLF)', '%', pf.plf?.daily, pf.plf?.mtd, pf.plf?.ytd, 4);
    dataRow('Plant Availability Factor (PAF)', '%', pf.paf?.daily, pf.paf?.mtd, pf.paf?.ytd, 4);
    dataRow('Forced Outages', 'Nos', pf.outages?.forced?.daily, pf.outages?.forced?.mtd, pf.outages?.forced?.ytd, 0);
    dataRow('Planned Outages', 'Nos', pf.outages?.planned?.daily, pf.outages?.planned?.mtd, pf.outages?.planned?.ytd, 0);
    dataRow('RSD Count', 'Nos', pf.outages?.rsd?.daily, pf.outages?.rsd?.mtd, pf.outages?.rsd?.ytd, 0);
    dataRow('Specific Coal Consumption (SCC)', 'kg/kWh', pf.scc?.daily, pf.scc?.mtd, pf.scc?.ytd, 5);
    dataRow('Specific Oil Consumption (SOC)', 'ml/kWh', pf.soc?.daily, pf.soc?.mtd, pf.soc?.ytd, 5);
    dataRow('Gross Heat Rate (GHR)', 'kCal/kWh', pf.ghr?.daily, pf.ghr?.mtd, pf.ghr?.ytd, 2);
    dataRow('GCV (As Fired)', 'kCal/kg', pf.gcv?.daily, pf.gcv?.mtd, pf.gcv?.ytd, 0);

    // ── SECTION 3: CONSUMPTION & STOCK ───────────────────────────────────
    secHead('FUEL CONSUMPTION & STOCK');
    const cs = dgr.consumptionStock || {};
    dataRow('Coal Receipt', 'MT', cs.coalReceipt?.daily, cs.coalReceipt?.mtd, cs.coalReceipt?.ytd, 2);
    dataRow('Coal Consumption', 'MT', cs.coalConsumption?.daily, cs.coalConsumption?.mtd, cs.coalConsumption?.ytd, 2);
    dataRow('Coal Stock', 'MT', cs.coalStock?.daily, '-', '-', 2);
    dataRow('LDO Receipt', 'KL', cs.ldoReceipt?.daily, cs.ldoReceipt?.mtd, cs.ldoReceipt?.ytd, 2);
    dataRow('LDO Consumption', 'KL', cs.ldoConsumption?.daily, cs.ldoConsumption?.mtd, cs.ldoConsumption?.ytd, 2);
    dataRow('LDO Stock', 'KL', cs.ldoStock?.daily, '-', '-', 2);
    dataRow('HFO Receipt', 'KL', cs.hfoReceipt?.daily, cs.hfoReceipt?.mtd, cs.hfoReceipt?.ytd, 2);
    dataRow('HFO Consumption', 'KL', cs.hfoConsumption?.daily, cs.hfoConsumption?.mtd, cs.hfoConsumption?.ytd, 2);
    dataRow('HFO Stock', 'KL', cs.hfoStock?.daily, '-', '-', 2);
    dataRow('H₂ Consumption', 'Nos', cs.h2?.daily, '-', '-', 0);
    dataRow('H₂ Stock', 'Nos', cs.h2?.stock, '-', '-', 0);

    secHead('WATER');
    dataRow('DM Water Generation', 'm³', cs.dmWater?.daily, '-', '-', 2);
    dataRow('DM Water Cycle Makeup', 'm³', cs.dmWater?.daily, '-', '-', 2);
    dataRow('DM Water Total Consumption', 'm³', cs.dmWaterTotal?.daily, '-', '-', 2);
    dataRow('DM Cycle %', '%', cs.dmWater?.pct, '-', '-', 4);
    dataRow('Service Water Consumption', 'm³', cs.serviceWater?.daily, '-', '-', 2);
    dataRow('Potable Water Consumption', 'm³', cs.potableWater?.daily, '-', '-', 2);
    dataRow('Sea Water Consumption', 'm³', cs.seaWater?.daily, '-', '-', 2);

    // ── SECTION 4: SCHEDULING ─────────────────────────────────────────────
    secHead('POWER SCHEDULE');
    const sc = dgr.scheduling || {};
    dataRow('Declared Capacity (SEPC)', 'MU', sc.dcSEPC?.daily, sc.dcSEPC?.mtd, sc.dcSEPC?.ytd);
    dataRow('Declared Capacity (TNPDCL)', 'MU', sc.dcTNPDCL?.daily, sc.dcTNPDCL?.mtd, sc.dcTNPDCL?.ytd);
    dataRow('Schedule Generation (PPA)', 'MU', sc.sgPPA?.daily, sc.sgPPA?.mtd, sc.sgPPA?.ytd);
    dataRow('Schedule Generation (DAM)', 'MU', sc.sgDAM?.daily, sc.sgDAM?.mtd, sc.sgDAM?.ytd);
    dataRow('Schedule Generation (RTM)', 'MU', sc.sgRTM?.daily, sc.sgRTM?.mtd, sc.sgRTM?.ytd);
    dataRow('URS @ DAM', 'MWH', sc.ursDAM?.daily, '-', '-', 2);
    dataRow('URS @ RTM', 'MWH', sc.ursRTM?.daily, '-', '-', 2);

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
