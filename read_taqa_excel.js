/**
 * read_taqa_excel.js
 * Read exact Excel values for the 3 TAQA audit dates from 24 cal, Chem Input, and Ops Input sheets
 */
const path = require('path');
const ExcelJS = require('exceljs');

const EXCEL_PATH = path.join(__dirname, 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx');
const DATES = ['2025-08-19', '2025-12-05', '2026-01-21'];

function unwrap(v) { return (v && typeof v === 'object' && 'result' in v) ? v.result : v; }

function buildColIndex(ws) {
  const idx = new Map();
  if (!ws) return idx;
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
  if (v instanceof Date) return null;
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    return (v.result != null && typeof v.result === 'number') ? v.result : null;
  }
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return null;
}

function getHrs(ws, row, col) {
  if (!col) return null;
  let v = unwrap(ws.getRow(row).getCell(col).value);
  if (v == null) return null;
  if (v instanceof Date) {
    return (v.getTime() / 86400000 + 25569) * 24;
  }
  if (typeof v === 'number') return v * 24;
  return null;
}

async function main() {
  console.log('Loading Excel...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const ws24 = wb.getWorksheet('24 cal');
  const wsChem = wb.getWorksheet('Chem Input');
  const wsOps = wb.getWorksheet('Ops Input');

  console.log('Worksheets:', wb.worksheets.map(w => w.name).join(', '));

  const colIdx24 = buildColIndex(ws24);
  const colIdxChem = wsChem ? buildColIndex(wsChem) : new Map();
  const colIdxOps = wsOps ? buildColIndex(wsOps) : new Map();

  console.log('\n24 cal date→col:', Object.fromEntries(colIdx24));
  console.log('Chem Input date→col:', Object.fromEntries(colIdxChem));
  console.log('Ops Input date→col:', Object.fromEntries(colIdxOps));

  for (const date of DATES) {
    const col24 = colIdx24.get(date);
    const colChem = colIdxChem.get(date);
    const colOps = colIdxOps.get(date);

    console.log(`\n═══════════════════════════════════════════`);
    console.log(`DATE: ${date}  | 24cal col=${col24}  Chem col=${colChem}  Ops col=${colOps}`);

    if (ws24 && col24) {
      console.log('\n--- 24 cal sheet ---');
      const g = (r) => getNum(ws24, r, col24);
      const h = (r) => getHrs(ws24, r, col24);
      console.log(`R4  HFO Receipt (MT):         ${g(4)}`);
      console.log(`R5  HFO Consumption (MT):      ${g(5)}`);
      console.log(`R6  HFO Stock T10+T20:         ${g(6)}`);
      console.log(`R9  HSD Stock:                 ${g(9)}`);
      console.log(`R10 HSD T30:                   ${g(10)}`);
      console.log(`R14 HSD T40:                   ${g(14)}`);
      console.log(`R15 Lignite Lifted NLC:        ${g(15)}`);
      console.log(`R17 Lignite Receipt:           ${g(17)}`);
      console.log(`R18 Lignite 1A+1B:             ${g(18)}`);
      console.log(`R19 Lignite bunker lvl:        ${g(19)}`);
      console.log(`R20 Bunker-corr lignite:       ${g(20)}`);
      console.log(`R22 Lignite Stock Plant:       ${g(22)}`);
      console.log(`R23 Fuel Master 250MW:         ${g(23)}`);
      console.log(`R27 Net Export (MWh):          ${g(27)}`);
      console.log(`R28 Sched Gen (MWh):           ${g(28)}`);
      console.log(`R29 Ex-bus SG:                 ${g(29)}`);
      console.log(`R30 Net Import (MWh):          ${g(30)}`);
      console.log(`R32 Gross Gen (MWh):           ${g(32)}`);
      console.log(`R34 Aux Cons (MWh):            ${g(34)}`);
      console.log(`R36 Declared Cap (MWh):        ${g(36)}`);
      console.log(`R37 Deemed Gen (MWh):          ${g(37)}`);
      console.log(`R38 Dispatch Demand (MWh):     ${g(38)}`);
      console.log(`R39 DD% :                      ${g(39)}`);
      console.log(`R40 Unit Trips:                ${g(40)}`);
      console.log(`R41 Unit Shutdown:             ${g(41)}`);
      console.log(`R42 Unit On Grid hrs:          ${h(42)}`);
      console.log(`R43 Load Backdown hrs:         ${h(43)}`);
      console.log(`R44 Standby hrs:               ${h(44)}`);
      console.log(`R45 Sched Outage hrs:          ${h(45)}`);
      console.log(`R46 Forced Outage hrs:         ${h(46)}`);
      console.log(`R47 Derated hrs:               ${h(47)}`);
      console.log(`R48 GCV As Fired:              ${g(48)}`);
      console.log(`R49 GHR As Fired:              ${g(49)}`);
      console.log(`R50 APC%:                      ${g(50)}`);
      console.log(`R51 PLF%:                      ${g(51)}`);
      console.log(`R53 Sched Gen Revision:        ${g(53)}`);
      console.log(`R58 DM Water Prod:             ${g(58)}`);
      console.log(`R59 DM Water Main Boiler:      ${g(59)}`);
      console.log(`R63 Total DM Water:            ${g(63)}`);
      console.log(`R64 CW Blowdown (m3):          ${g(64)}`);
      console.log(`R65 CW Blowdown Rate:          ${g(65)}`);
      console.log(`R68 Service Water:             ${g(68)}`);
      console.log(`R71 Potable Water:             ${g(71)}`);
      console.log(`R72 Seal Water:                ${g(72)}`);
      console.log(`R74 Raw Water Rate:            ${g(74)}`);
      console.log(`R79 Ash Water Reuse:           ${g(79)}`);
      console.log(`R80 Ash Water Rate:            ${g(80)}`);
      console.log(`R125 Ash Gen (MT):             ${g(125)}`);
      console.log(`R127 Bottom Ash Internal (T):  ${g(127)}`);
      console.log(`R128 Bottom Ash External (T):  ${g(128)}`);
      console.log(`R129 Fly Ash Trucks (T):       ${g(129)}`);
      console.log(`R130 Fly Ash Silo (%):         ${g(130)}`);
      console.log(`R147 LOI Bottom Ash:           ${g(147)}`);
      console.log(`R148 LOI Fly Ash:              ${g(148)}`);
    }

    if (wsChem && colChem) {
      console.log('\n--- Chem Input sheet ---');
      const gc = (r) => getNum(wsChem, r, colChem);
      console.log(`R3  Ash %:                     ${gc(3)}`);
      console.log(`R4  GCV (kcal/kg):             ${gc(4)}`);
      console.log(`R5  UBC Bottom Ash:            ${gc(5)}`);
      console.log(`R6  UBC Fly Ash:               ${gc(6)}`);
    }

    if (wsOps && colOps) {
      console.log('\n--- Ops Input sheet ---');
      const go = (r) => getNum(wsOps, r, colOps);
      // Check rows around HFO integrators
      console.log(`R10 HFO Supply Int Rdg:        ${go(10)}`);
      console.log(`R11 HFO Return Int Rdg:        ${go(11)}`);
      console.log(`R46 Schedule Gen MLDC:         ${go(46)}`);
      console.log(`R80 DM Water Prod (m3):        ${go(80)}`);
      console.log(`R137 FA Silo Level (%):        ${go(137)}`);
      // Also check a broader range to find the right rows
      for (let r = 1; r <= 20; r++) {
        const v = go(r);
        if (v != null) console.log(`  Ops R${r}: ${v}`);
      }
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
