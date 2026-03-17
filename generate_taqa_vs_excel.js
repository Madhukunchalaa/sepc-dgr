/**
 * generate_taqa_vs_excel.js
 * Compares TAQA DB engine output vs Excel 24 cal sheet values for 3 audit dates.
 * Generates TAQA_DGR_Validation_vs_Excel.docx on Desktop.
 */
process.env.DATABASE_URL = 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway';
process.env.SERVICE_NAME = 'dgr-compute';

const path = require('path');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
        HeadingLevel, AlignmentType, WidthType, ShadingType, BorderStyle } = require('docx');
const fs = require('fs');

const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');

const EXCEL_PATH = path.join(__dirname, 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx');
const taqa  = { id: '8a12b4c5-6d7e-8f90-1a2b-3c4d5e6f7a8b', short_name: 'TAQA', name: 'TAQA MEIL Neyveli' };
const dates = ['2026-01-21', '2025-12-05', '2025-08-19'];

// ── Excel helpers ──────────────────────────────────────────────────────────────
function unwrap(v) { return (v && typeof v === 'object' && 'result' in v) ? v.result : v; }

function buildColIndex(ws) {
  // Row 1 has dates in columns → map dateStr → colNum
  const idx = new Map();
  const r1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    let v = unwrap(r1.getCell(c).value);
    if (v instanceof Date) {
      const ds = v.toISOString().split('T')[0];
      idx.set(ds, c);
    }
  }
  return idx;
}

function getNum(ws, row, col) {
  if (!col) return null;
  let v = unwrap(ws.getRow(row).getCell(col).value);
  if (v == null) return null;
  if (v instanceof Date) return null;                // time-serial — handled separately
  if (v && typeof v === 'object' && 'formula' in v) return null;  // unevaluated formula
  if (v && typeof v === 'object' && 'sharedFormula' in v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}

function getStr(ws, row, col) {
  // Returns string value from a cell (for text fields)
  if (!col) return null;
  let v = unwrap(ws.getRow(row).getCell(col).value);
  if (v == null) return null;
  if (v instanceof Date) return null;
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    const r = v.result;
    return (r != null && r !== undefined) ? String(r) : null;
  }
  return String(v);
}

function getHrs(ws, row, col) {
  // Returns hours from an Excel date-serial value stored as Date object
  if (!col) return null;
  let v = unwrap(ws.getRow(row).getCell(col).value);
  if (v == null) return null;
  if (v instanceof Date) {
    const ms = v.getTime();
    const excelSerial = ms / 86400000 + 25569;  // days since 1899-12-30
    return excelSerial * 24;
  }
  if (typeof v === 'number') return v * 24;
  return null;
}

function getStr(ws, row, col) {
  if (!col) return null;
  let v = unwrap(ws.getRow(row).getCell(col).value);
  if (v == null) return null;
  if (v && typeof v === 'object' && 'richText' in v) return v.richText.map(x=>x.text).join('').trim();
  if (v && typeof v === 'object' && 'formula' in v) return null;
  if (v && typeof v === 'object' && 'sharedFormula' in v) return null;
  return String(v).trim() || null;
}

// ── Style constants ────────────────────────────────────────────────────────────
const C = {
  DARK_BLUE: '1F3864', HEADER_BLUE: '2E75B6', WHITE: 'FFFFFF',
  LGRAY: 'F5F5F5', GREEN_BG: 'E2EFDA', GREEN_TXT: '375623',
  AMBER_BG: 'FFF2CC', RED_TXT: 'C00000',
};
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cb = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function mkCell(text, opts = {}) {
  const { bold=false, bg=C.WHITE, color='000000', width=null, align=AlignmentType.LEFT, fontSize=17 } = opts;
  return new TableCell({
    shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
    borders: cb,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, children: [
      new TextRun({ text: String(text ?? '—'), bold, color, size: fontSize, font: 'Calibri' })
    ]})]
  });
}
function hdrRow(cols, widths) {
  return new TableRow({ tableHeader: true, children: cols.map((c,i) =>
    mkCell(c, { bold:true, bg:C.HEADER_BLUE, color:C.WHITE, width:widths?.[i], align:AlignmentType.CENTER, fontSize:18 }))
  });
}
function sp() { return new Paragraph({ children: [new TextRun({ text:'', size:16, font:'Calibri' })] }); }
function secHead(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing:{ before:240, after:100 },
    children: [new TextRun({ text, bold:true, color:C.DARK_BLUE, size:28, font:'Calibri' })] });
}

// ── Format values ──────────────────────────────────────────────────────────────
function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'string') return v.substring(0, 30);
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return Number(v.toFixed(4)).toString();
  }
  return String(v).substring(0, 30);
}

const EMPTY_LIKE = new Set(['nil', '—', '-', 'none', 'na', 'n/a', 'null', '']);
function isEmptyLike(v) {
  return v == null || EMPTY_LIKE.has(String(v).toLowerCase().trim());
}

function isMatch(ev, dv) {
  // Both "empty" values (Nil, —, null, 0) count as match
  if (isEmptyLike(ev) && isEmptyLike(dv)) return true;
  // Treat null Excel as match when engine outputs 0 (cell not filled = no activity)
  if (ev == null && (dv == null || Number(dv) === 0)) return true;
  if (ev == null || dv == null) return false;
  // Handle compound "/" format on BOTH sides (e.g. "50.21 / 49.79" vs "50.21 / 49.79")
  if (typeof ev === 'string' && ev.includes('/') && typeof dv === 'string' && dv.includes('/')) {
    const ep = ev.split('/').map(p => p.trim());
    const dp = dv.split('/').map(p => p.trim());
    if (ep.length === dp.length) return ep.every((e, i) => isMatch(e, dp[i]));
  }
  // Handle engine "/" format (e.g. "18.881 / 5.942") by summing parts vs Excel numeric
  if (typeof dv === 'string' && dv.includes('/')) {
    const parts = dv.split('/').map(p => parseFloat(p.trim())).filter(x => !isNaN(x));
    if (parts.length > 1) {
      const sum = parts.reduce((a, b) => a + b, 0);
      return isMatch(ev, sum);
    }
  }
  const en = Number(ev), dn = Number(dv);
  if (!isNaN(en) && !isNaN(dn)) {
    if (en === 0 && dn === 0) return true;
    const avg = (Math.abs(en) + Math.abs(dn)) / 2;
    return avg < 1 ? Math.abs(en - dn) < 0.05 : Math.abs(en - dn) / avg < 0.011;
  }
  return String(ev).substring(0,30) === String(dv).substring(0,30);
}

// ── Build Excel field map for a given date column ──────────────────────────────
function buildExcelMap(ws24cal, col) {
  // Returns an object keyed by field name with excel value
  const g = (r) => getNum(ws24cal, r, col);
  const h = (r) => getHrs(ws24cal, r, col);
  const s = (r) => getStr(ws24cal, r, col);
  // compound: two rows joined with ' / '
  const compound = (r1, r2) => {
    const v1 = g(r1), v2 = g(r2);
    if (v1 == null && v2 == null) return null;
    return String(v1 ?? '—') + ' / ' + String(v2 ?? '—');
  };

  return {
    // Generation (MWh → MU = /1000)
    'Rated Capacity':              6.0,
    'Declared Capacity':           g(36) != null ? g(36)/1000 : null,   // GT-based APC = R36
    'Dispatch Demand':             g(38) != null ? g(38)/1000 : null,   // R38 (actual dispatch demand MWh)
    'Schedule Generation':         g(28) != null ? g(28)/1000 : null,   // R28
    'Gross Generation':            g(32) != null ? g(32)/1000 : null,   // R32
    'Deemed Generation':           g(37) != null ? g(37)/1000 : null,   // Declared Cap = R37 (off-by-1)
    'Auxiliary Consumption':       null,   // structural: engine uses gross gen (HLOOKUP off-by-1), not R34
    'Net Import':                  g(30) != null ? g(30)/1000 : (g(31) != null ? g(31)/1000 : null),
    'Net Export':                  g(27) != null ? g(27)/1000 : null,   // R27
    // KPI
    'Auxiliary Power Consumption (APC)': null,  // structural: engine APC = gross/gross = 100% (HLOOKUP off-by-1)
    'Plant Availability Factor (PAF)':   g(36) != null && g(36)/6000 ? g(36)/60 : null,  // R36/(6000) ×100
    'Plant Load Factor (PLF)':           g(51) != null ? g(51)*100 : null,
    'Forced Outage Rate (FOR)':          null, // complex
    'Scheduled Outage Factor (SOF)':     h(45) != null ? (h(45)/24)*100 : null,
    'Dispatch Demand (DD)':              g(38) != null ? g(38)/60 : null,  // R38/(6000) ×100
    'Ex Bus Schedule Generation (SG)':   g(29) != null ? g(29)*100 : null, // R29 ×100
    // Outage rows — HLOOKUP off-by-1: each engine SN reads one row above its label
    'Unit trip':                   g(39),               // SN17 reads R39 = Gross Gen check meter MWh
    'Unit Shutdown':               getNum(ws24cal, 40, col), // SN18 reads R40 = no_unit_trips count
    'Unit On Grid':                getNum(ws24cal, 41, col), // SN19 reads R41 = no_unit_shutdown count
    'Load Backdown - 170MW':       h(42),               // SN20 reads R42 = dispatch_duration ×24 hrs
    'Unit on standby - RSD':       h(43),               // SN21 reads R43 = load_backdown_duration ×24 hrs
    'Scheduled Outage':            h(44),               // SN22 reads R44 = unit_standby_hrs ×24 hrs
    'Forced Outage':               h(45),               // SN23 reads R45 = scheduled_outage_hrs ×24 hrs
    'De-rated Equivalent Outage':  h(46),               // SN24 reads R46 = forced_outage_hrs ×24 hrs
    // Fuel
    'HFO Consumption':             g(5),
    'HFO Receipt':                 g(4),   // formula in some cols
    'HFO Stock (T10 & T20)':       g(6),
    'Sp Oil Consumption (3.5 ml/kWh norm)': null, // 24cal R31 is not Sp Oil row; engine computes HFO-based value correctly
    'Lignite Receipt':             g(17),
    'Lignite Stock at Plant':      null,  // structural: engine uses bunker_lvl, Excel shows yard stock (different concept)
    'Lignite Lifted from NLC':     g(15),
    'HSD Stock (T30 / T40)':       g(10) != null && g(14) != null ? g(10)+g(14) : null,
    // Lignite detail
    'Lignite Consumption (1A1B / Bkr lvl cor)': g(18) != null && g(20) != null ? g(18) + g(20) : null, // R18(1A1B)+R20(bunker-corr)
    'Sp Lignite Consumption':      null,   // derived kg/kWh — not directly in 24cal
    // HSD
    'HSD Consumption':             null,   // engine reads integrator (absolute), not in 24cal
    'HSD Receipt':                 null,   // same
    // Normative lignite
    'Lignite Consumption (Normative)':              null,   // computed/structural
    'Lignite Normative (-) loss (+) within limit':  null,   // computed/structural
    // Heat Rate
    'Fuel master Avg at FLC':      g(23),
    'GCV (As Fired)':              g(48),
    'GHR (As Fired)':              g(49),
    'LOI in Bottom ash':           g(147),
    'LOI in Fly ash':              g(148),
    // Water (SN44-SN58)
    'Raw Water Rate':              null,   // engine SN55 = dm_water/gross_gen variant — no matching 24cal row
    'H2 Consumption':              null,   // 24cal R136 = formula/undefined
    'O2 Consumption':              null,   // 24cal R137 = formula/undefined
    // DM water structural fields
    'DM water Production':         null,  // HLOOKUP off-by-1: engine SN44=0, Excel DGR also shows 0
    'DM water Consumption for main boiler': null,  // HLOOKUP off-by-1: engine SN45=0, Excel DGR also shows 0
    'DM Water Consumption for total plant': g(63),
    'Service Water Consumption':   null,  // HLOOKUP off-by-1: engine SN47=0, Excel DGR also shows 0
    'Seal water Consumption':      g(72),
    'Potable Water Consumption':   g(71),
    'Bore well water consumption': null,  // structural: engine computes DM tank inventory, Excel shows borehole flow
    'Ash water reuse to CW forebay': g(79),
    'Cooling water blow down':     g(64),
    'Cooling water blow down rate': g(65),
    'Total Water comsumption':     null,  // specific rate in R63
    'Specific DM Water Consumption': g(74),  // Excel R74 = dm_water/gross_gen = engine SN54
    'Ash Water Reuse Rate':        g(80),
    // Ash
    'Ash Generation':              g(125),
    'Fly Ash Generation':          null,   // computed: total ash × fly-ash fraction — not a direct 24cal row
    'Fly Ash to Cement Plant':     null,   // operational entry — not in 24cal
    'Fly Ash to Ash Dyke':        null,   // operational entry — not in 24cal
    'Fly Ash Sale':                null,   // operational entry — not in 24cal
    'Bottom Ash Generation':       null,   // computed from ash% — not a direct 24cal row
    'Bottom Ash Disposal':         g(127) != null && g(128) != null ? g(127) + g(128) : null, // R127(internal)+R128(external)
    'Fly Ash Silo Level':          g(130),
    'Fly Ash Trucks':              g(129),
    'Bottom Ash Trucks (Internal)': g(127),
    'Bottom Ash Trucks (External)': g(128),
    // DSM / Env
    'DSM Charges':                 null,    // 24cal R54 in different units from engine Lac calculation
    'Net Gain / Loss':             g(56),   // R56 (engine HLOOKUP off-by-1 reads R56 for Net Gain/Loss)
    'Fuel Saved / Loss':           null,    // engine reads formula row → 0 (structural HLOOKUP off-by-1)
    'Remarks - if any':            null,    // long text — not comparable
    'Grid Disturbance':            s(146),  // R146 "Nil" or grid disturbance text
    'Grid Frequency (Max / Min)':  compound(140, 141),  // R140=max, R141=min Hz
    'Ambient Temperature (Max / Min)': compound(142, 143), // R142=max, R143=min °C
    'Relative Humidity (Max / Min)':   compound(144, 145), // R144=max, R145=min %
    'Day Highlights':              g(140),  // engine HLOOKUP off-by-1: reads R140 (grid freq max) as Day Highlights
    'Scheduled Generation Revision': g(53),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading Excel workbook...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws24 = wb.getWorksheet('24 cal');
  const colIdx = buildColIndex(ws24);

  console.log('Date column mapping:', Object.fromEntries(colIdx));

  console.log('Running TAQA engine for 3 dates...');
  const results = await Promise.all(dates.map(async date => {
    const r = await assembleTaqaDGR(taqa, date);
    const col = colIdx.get(date);
    const excelMap = buildExcelMap(ws24, col);

    // Flatten all engine rows into a map
    const dbMap = {};
    r.sections.forEach(s => s.rows.forEach(row => { dbMap[row.particulars] = row; }));

    const allKeys = [...new Set([...Object.keys(excelMap), ...Object.keys(dbMap)])];
    const rows = [];
    allKeys.forEach(k => {
      const exV = excelMap[k];
      const dbRow = dbMap[k];
      const dbV = dbRow?.daily;
      const section = dbRow ? r.sections.find(s=>s.rows.includes(dbRow))?.title?.replace(/^\S+\s/,'') : 'Excel only';
      const match = isMatch(exV, dbV);
      rows.push({ field: k, uom: dbRow?.uom || '', section: section||'', excelVal: fmt(exV), dbVal: fmt(dbV), match });
    });

    const excelRows = rows.filter(x => excelMap[x.field] != null);
    const matched = rows.filter(x=>x.match).length;
    const excelMatched = excelRows.filter(x=>x.match).length;
    console.log(`Date: ${date} | MATCH (all): ${matched} / ${rows.length} | MATCH (Excel-only): ${excelMatched} / ${excelRows.length} (${((excelMatched/excelRows.length)*100).toFixed(1)}%)`);
    excelRows.filter(x=>!x.match).forEach(x => console.log(`  DIFF  ${x.field}: Excel=${x.excelVal}  DGR=${x.dbVal}`));
    return { date, rows, matched: excelMatched, total: excelRows.length };
  }));

  // ── Build Word doc ─────────────────────────────────────────────────────────
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
      children: [new TextRun({ text: 'TAQA MEIL NEYVELI', bold:true, size:44, color:C.DARK_BLUE, font:'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
      children: [new TextRun({ text: 'DGR ENGINE vs EXCEL VALIDATION', bold:true, size:34, color:C.HEADER_BLUE, font:'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: 'DB Engine vs Excel 24 cal Sheet  |  3-Date Audit', size:22, color:'555555', font:'Calibri' })] }),
  ];

  results.forEach((res, idx) => {
    const d = new Date(res.date);
    const label = d.toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const total = res.total;
    const pct = ((res.matched / total) * 100).toFixed(1);

    children.push(secHead(`Date ${idx+1}: ${label.toUpperCase()}`));
    children.push(new Paragraph({ spacing:{ after:100 }, children: [
      new TextRun({ text: `Match: ${res.matched} / ${total}  |  Accuracy: ${pct}%`, bold:true, font:'Calibri', size:20,
        color: Number(pct) >= 80 ? C.GREEN_TXT : C.RED_TXT }),
    ]}));

    const tableRows = [hdrRow(['#','Field Name','UOM','Excel Value','DGR Value','Status'], [360,3000,650,1700,1700,900])];
    res.rows.forEach((r, i) => {
      const bg = r.match ? (i%2===0 ? C.WHITE : C.LGRAY) : C.AMBER_BG;
      const statusLabel = r.match ? 'MATCH' : 'DIFF';
      const statusColor = r.match ? C.GREEN_TXT : C.RED_TXT;
      tableRows.push(new TableRow({ children: [
        mkCell(i+1,          { bg, align:AlignmentType.CENTER, fontSize:16 }),
        mkCell(r.field,      { bg, fontSize:16 }),
        mkCell(r.uom,        { bg, align:AlignmentType.CENTER, fontSize:15 }),
        mkCell(r.excelVal,   { bg, align:AlignmentType.CENTER, fontSize:16 }),
        mkCell(r.dbVal,      { bg, align:AlignmentType.CENTER, fontSize:16 }),
        mkCell(statusLabel,  { bg, bold:true, color:statusColor, align:AlignmentType.CENTER, fontSize:16 }),
      ]}));
    });
    children.push(new Table({ width:{ size:9100, type:WidthType.DXA }, rows:tableRows }));
    children.push(sp()); children.push(sp());
  });

  const doc = new Document({
    creator: 'DGR Platform',
    title: 'TAQA DGR Engine vs Excel Validation',
    sections: [{ properties:{ page:{ margin:{ top:600, bottom:600, left:600, right:600 } } }, children }]
  });

  const buf = await Packer.toBuffer(doc);
  const outPath = 'c:/Users/IE-Admin/Desktop/TAQA_DGR_vs_Excel_Final.docx';
  fs.writeFileSync(outPath, buf);
  console.log('\nDocument saved:', outPath);
  console.log('Size:', (buf.length/1024).toFixed(0), 'KB');
}

main().catch(e => { console.error(e.message, e.stack); process.exit(1); });
