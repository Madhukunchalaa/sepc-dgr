// services/report-export/src/controllers/export.controller.js
const ExcelJS = require('exceljs');
const axios   = require('axios');
const { success, error } = require('../shared/response');
const logger  = require('../shared/logger');

const DGR_COMPUTE_URL = process.env.DGR_COMPUTE_SERVICE_URL || 'http://localhost:3004';

// ── Helper: fetch fully computed DGR from compute service ──
async function fetchDGR(plantId, date, authHeader) {
  const resp = await axios.get(
    `${DGR_COMPUTE_URL}/api/dgr/${plantId}/${date}`,
    { headers: { Authorization: authHeader } }
  );
  return resp.data.data;
}

// ── Excel DGR Export — mirrors your original Excel format ──
exports.exportDGRExcel = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const dgr = await fetchDGR(plantId, date, req.headers.authorization);

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'DGR Portal — SEPC Power';
    wb.modified = new Date();

    const ws = wb.addWorksheet('DGR', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    // ── Column widths ──
    ws.columns = [
      { width: 6 }, { width: 45 }, { width: 12 },
      { width: 16 }, { width: 16 }, { width: 16 },
      { width: 14 }, { width: 14 },
    ];

    // ── Styles ──
    const headerStyle = {
      font:      { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    };
    const sectionStyle = {
      font:  { bold: true, size: 11, color: { argb: 'FF1E3A5F' } },
      fill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
    };
    const labelStyle = {
      font:      { size: 10 },
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
      border:    { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } },
    };
    const valueStyle = {
      font:      { size: 10, bold: true },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border:    { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } },
      numFmt:    '#,##0.000',
    };
    const colHdrStyle = {
      font:      { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border:    { all: { style: 'thin', color: { argb: 'FF1D4ED8' } } },
    };

    let row = 1;

    // ── Title block ──
    ws.mergeCells(`A${row}:H${row}`);
    const titleCell = ws.getCell(`A${row}`);
    titleCell.value = dgr.header.title;
    Object.assign(titleCell, headerStyle);
    ws.getRow(row).height = 28;
    row++;

    ws.mergeCells(`A${row}:H${row}`);
    const co = ws.getCell(`A${row}`);
    co.value = dgr.header.company;
    co.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    co.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    co.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row).height = 20;
    row++;

    // Column headers
    const colHdrRow = ws.getRow(row);
    ['SN', 'PARTICULARS', 'UoM', dgr.header.dayName, `MTD ${dgr.header.monthYear}`, `YTD ${dgr.header.fyLabel}`, '', ''].forEach((h, i) => {
      const cell = colHdrRow.getCell(i + 1);
      cell.value = h;
      Object.assign(cell, colHdrStyle);
    });
    ws.getRow(row).height = 22;
    row++;

    // ── Helper to add a data row ──
    const addRow = (sn, label, uom, daily, mtd, ytd, extra1 = '', extra2 = '') => {
      const r = ws.getRow(row);
      r.getCell(1).value = sn;
      r.getCell(2).value = label;
      r.getCell(3).value = uom;
      r.getCell(4).value = typeof daily === 'number' ? parseFloat(daily.toFixed(3)) : daily;
      r.getCell(5).value = typeof mtd   === 'number' ? parseFloat(mtd.toFixed(3))   : mtd;
      r.getCell(6).value = typeof ytd   === 'number' ? parseFloat(ytd.toFixed(3))   : ytd;
      r.getCell(7).value = extra1;
      r.getCell(8).value = extra2;
      [1,2,3,4,5,6,7,8].forEach(c => {
        const cell = r.getCell(c);
        if (c === 2) Object.assign(cell, labelStyle);
        else if ([4,5,6].includes(c)) Object.assign(cell, valueStyle);
        else cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
      });
      ws.getRow(row).height = 18;
      row++;
    };

    const addSection = (label) => {
      ws.mergeCells(`A${row}:H${row}`);
      const cell = ws.getCell(`A${row}`);
      cell.value = label;
      Object.assign(cell, sectionStyle);
      ws.getRow(row).height = 20;
      row++;
    };

    // ── 1. POWER ──
    addSection('1.  POWER:');
    const p = dgr.power;
    addRow('1.1', p.generation.label,  p.generation.uom,  p.generation.daily,  p.generation.mtd,  p.generation.ytd);
    addRow('1.2', p.avgLoad.label,     p.avgLoad.uom,     p.avgLoad.daily,     p.avgLoad.mtd,     p.avgLoad.ytd);
    addRow('1.3', p.exportGT.label,    p.exportGT.uom,    p.exportGT.daily,    p.exportGT.mtd,    p.exportGT.ytd);
    addRow('',    p.importGT.label,    p.importGT.uom,    p.importGT.daily,    p.importGT.mtd,    p.importGT.ytd);
    addRow('',    'Net Export (GT Export - GT Import)', 'MU',
           (p.exportGT.daily||0) - (p.importGT.daily||0),
           (p.exportGT.mtd||0)   - (p.importGT.mtd||0),
           (p.exportGT.ytd||0)   - (p.importGT.ytd||0));
    addRow('1.4', p.apc.label,         p.apc.uom,         p.apc.daily,         p.apc.mtd,         p.apc.ytd);
    addRow('',    'APC %',             '%',               p.apc.pct?.daily,    p.apc.pct?.mtd,    p.apc.pct?.ytd);
    addRow('1.5', p.hoursOnGrid.label, p.hoursOnGrid.uom, p.hoursOnGrid.daily, '', '');
    addRow('1.6', 'Grid Frequency', 'Hz',
           `Min: ${p.gridFrequency.min} / Max: ${p.gridFrequency.max}`, '', '');

    // ── 2. PERFORMANCE ──
    addSection('2.  PERFORMANCE:');
    const pf = dgr.performance;
    addRow('2.1', pf.plf.label,   pf.plf.uom,   pf.plf.daily,   pf.plf.mtd,   pf.plf.ytd);
    addRow('2.2', pf.paf.label,   pf.paf.uom,   pf.paf.daily,   pf.paf.mtd,   pf.paf.ytd);
    addRow('2.3', 'Plant Outage (Forced)', 'Count', pf.outages.forced.daily, pf.outages.forced.mtd, pf.outages.forced.ytd);
    addRow('',    'Plant Outage (Planned)', 'Count', pf.outages.planned.daily, pf.outages.planned.mtd, pf.outages.planned.ytd);
    addRow('2.4', pf.soc.label,   pf.soc.uom,   pf.soc.daily,   pf.soc.mtd,   pf.soc.ytd);
    addRow('2.5', pf.scc.label,   pf.scc.uom,   pf.scc.daily,   pf.scc.mtd,   pf.scc.ytd);
    addRow('2.6', pf.ghr.label,   pf.ghr.uom,   pf.ghr.daily,   pf.ghr.mtd,   pf.ghr.ytd);
    addRow('2.7', pf.gcv.label,   pf.gcv.uom,   pf.gcv.daily,   pf.gcv.mtd,   pf.gcv.ytd);

    // ── 3. CONSUMPTION & STOCK ──
    addSection('3.  CONSUMPTION & STOCK:');
    const cs = dgr.consumptionStock;
    addRow('3.1',  cs.ldoConsumption.label,  cs.ldoConsumption.uom,  cs.ldoConsumption.daily,  cs.ldoConsumption.mtd,  cs.ldoConsumption.ytd);
    addRow('3.2',  cs.hfoConsumption.label,  cs.hfoConsumption.uom,  cs.hfoConsumption.daily,  cs.hfoConsumption.mtd,  cs.hfoConsumption.ytd);
    addRow('3.3',  cs.coalConsumption.label, cs.coalConsumption.uom, cs.coalConsumption.daily, cs.coalConsumption.mtd, cs.coalConsumption.ytd);
    addRow('3.7',  cs.ldoStock.label,        cs.ldoStock.uom,        cs.ldoStock.daily, '', '');
    addRow('3.8',  cs.hfoStock.label,        cs.hfoStock.uom,        cs.hfoStock.daily, '', '');
    addRow('3.9',  cs.coalStock.label,       cs.coalStock.uom,       cs.coalStock.daily, '', '');
    addRow('3.10', cs.dmWater.label,         cs.dmWater.uom,         cs.dmWater.daily, '', '');
    addRow('3.14', cs.seaWater.label,        cs.seaWater.uom,        cs.seaWater.daily, '', '');

    // ── 4. POWER SCHEDULE ──
    addSection('4.  POWER SCHEDULE:');
    const sc = dgr.scheduling;
    addRow('4.1', sc.dcSEPC.label,   sc.dcSEPC.uom,   sc.dcSEPC.daily,   sc.dcSEPC.mtd,   sc.dcSEPC.ytd);
    addRow('4.2', sc.sgPPA.label,    sc.sgPPA.uom,    sc.sgPPA.daily,    sc.sgPPA.mtd,    sc.sgPPA.ytd);
    addRow('4.3', sc.sgDAM.label,    sc.sgDAM.uom,    sc.sgDAM.daily,    sc.sgDAM.mtd,    sc.sgDAM.ytd);
    addRow('4.4', sc.sgRTM.label,    sc.sgRTM.uom,    sc.sgRTM.daily,    sc.sgRTM.mtd,    sc.sgRTM.ytd);

    // Footer
    row++;
    ws.mergeCells(`A${row}:H${row}`);
    ws.getCell(`A${row}`).value = `Generated by DGR Portal on ${new Date().toLocaleString('en-IN')} | Document: ${dgr.header.documentNumber}`;
    ws.getCell(`A${row}`).font  = { size: 8, italic: true, color: { argb: 'FF999999' } };
    ws.getCell(`A${row}`).alignment = { horizontal: 'right' };

    // Stream to response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="DGR_${dgr.header.plantName}_${date}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    logger.error('Excel export error', { message: err.message });
    return error(res, 'Failed to generate Excel export', 500);
  }
};

// ── SAP Export (kWh format) ──
exports.exportSAP = async (req, res) => {
  try {
    const { plantId, date } = req.params;
    const dgr = await fetchDGR(plantId, date, req.headers.authorization);
    const p   = dgr.power;
    const f   = dgr.consumptionStock;

    const sapData = {
      date,
      generationKWh:     Math.round((p.generation.daily || 0) * 1000000),
      exportKWh:         Math.round((p.exportGT.daily  || 0) * 1000000),
      apcKWh:            Math.round((p.apc.daily       || 0) * 1000000),
      dcMU:              dgr.scheduling.dcSEPC.daily,
      sgPPAKWh:          Math.round((dgr.scheduling.sgPPA.daily || 0) * 1000000),
      sgDAMKWh:          Math.round((dgr.scheduling.sgDAM.daily || 0) * 1000000),
      sgRTMKWh:          Math.round((dgr.scheduling.sgRTM.daily || 0) * 1000000),
      coalConsMT:        f.coalConsumption.daily,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="SAP_DGR_${date}.json"`);
    return res.json({ success: true, data: sapData });

  } catch (err) {
    logger.error('SAP export error', { message: err.message });
    return error(res, 'Failed to generate SAP export', 500);
  }
};
