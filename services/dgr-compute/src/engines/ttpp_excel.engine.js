// services/dgr-compute/src/engines/ttpp_excel.engine.js
// Reads TTPP DGR data directly from Excel source sheets for exact match
const path = require('path');
const ExcelJS = require('exceljs');
const { query } = require('../shared/db');

const EXCEL_PATH = path.join(
    __dirname, '../../../..',
    '_dev_scripts', 'excel_docs',
    'DGR FY 2025-20261 - V1 (1).xlsx'
);

// Process-level workbook cache
let _cachedWb = null;
async function getWorkbook() {
    if (_cachedWb) return _cachedWb;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    _cachedWb = wb;
    return wb;
}

// Unwrap exceljs formula result object to its actual value
function unwrap(val) {
    if (val && typeof val === 'object' && 'result' in val) return val.result;
    return val;
}

// Convert exceljs cell value to "YYYY-MM-DD" string
function cellToDateStr(val) {
    val = unwrap(val);
    if (val == null) return null;
    if (val instanceof Date) {
        const y = val.getUTCFullYear();
        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
        const d = String(val.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number' && val > 1000) {
        // Excel date serial (days since 1899-12-30)
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return val.substring(0, 10);
    }
    return null;
}

// Build date → rowNumber index for a worksheet (date expected in col 1)
function buildDateIndex(ws) {
    const idx = new Map();
    if (!ws) return idx;
    ws.eachRow((row, rowNum) => {
        const ds = cellToDateStr(row.getCell(1).value);
        if (ds) idx.set(ds, rowNum);
    });
    return idx;
}

// Get numeric value at (rowNum, col) — null if missing/non-numeric
function numVal(ws, rowNum, col) {
    if (!ws || !rowNum) return null;
    const v = unwrap(ws.getRow(rowNum).getCell(col).value);
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
    }
    return null;
}

// Get string value at (rowNum, col)
function strVal(ws, rowNum, col) {
    if (!ws || !rowNum) return null;
    const v = unwrap(ws.getRow(rowNum).getCell(col).value);
    if (v == null) return null;
    return String(v);
}

// Format HH:MM from an Excel time/date value (Date object or numeric serial fraction)
function formatHoursOnGrid(rawVal) {
    if (rawVal == null) return null;
    let totalHours;
    if (rawVal instanceof Date) {
        // exceljs returns a Date for time-serial cells; recover Excel serial via UTC epoch math.
        // Excel epoch = Dec 30, 1899 = Unix epoch - 25569 days
        const excelSerial = rawVal.getTime() / 86400000 + 25569;
        totalHours = excelSerial * 24;
    } else if (typeof rawVal === 'number') {
        // raw Excel serial/fraction (0-1 for time, or integer days + fraction)
        totalHours = rawVal * 24;
    } else {
        return null;
    }
    if (totalHours <= 0) return null;
    const h = Math.floor(totalHours);
    const mm = Math.round((totalHours - h) * 60);
    return h + ':' + String(mm).padStart(2, '0');
}

// Get raw cell value (for special types like time) — unwraps formula results
function rawVal(ws, rowNum, col) {
    if (!ws || !rowNum) return null;
    return unwrap(ws.getRow(rowNum).getCell(col).value);
}

async function getPlant(plantId) {
    const { rows } = await query(
        `SELECT *,
            CASE
              WHEN EXTRACT(MONTH FROM NOW()) >= fy_start_month
              THEN EXTRACT(YEAR FROM NOW())::TEXT || '-' || (EXTRACT(YEAR FROM NOW())+1)::TEXT
              ELSE (EXTRACT(YEAR FROM NOW())-1)::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT
            END AS fy_label
         FROM plants WHERE id = $1`, [plantId]
    );
    return rows[0];
}

async function assembleTtppExcelDGR(plant, targetDate) {
    const wb = await getWorkbook();

    // Source worksheets
    const wsP  = wb.getWorksheet('Power');
    const wsF  = wb.getWorksheet('Fuel & Ash');
    const wsPf = wb.getWorksheet('Perf');
    const wsW  = wb.getWorksheet('Water');
    const wsDC = wb.getWorksheet('DC-SG');
    const wsU  = wb.getWorksheet('URS');
    const wsLT = wb.getWorksheet('Lvl & Totalizer');

    // Build date indices (date is in col 1 = column A)
    const idxP  = buildDateIndex(wsP);
    const idxF  = buildDateIndex(wsF);
    const idxPf = buildDateIndex(wsPf);
    const idxW  = buildDateIndex(wsW);
    const idxDC = buildDateIndex(wsDC);
    const idxU  = buildDateIndex(wsU);
    const idxLT = buildDateIndex(wsLT);

    // T-2 date for GHR / GCV
    const t2Date = (() => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - 2);
        return d.toISOString().split('T')[0];
    })();
    const t2Label = new Date(t2Date)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .replace(/ /g, '-');

    // Row numbers for target date and T-2
    const rP   = idxP.get(targetDate);
    const rF   = idxF.get(targetDate);
    const rW   = idxW.get(targetDate);
    const rDC  = idxDC.get(targetDate);
    const rU   = idxU.get(targetDate);
    const rLT  = idxLT.get(targetDate);
    const rPfT2 = idxPf.get(t2Date);
    const rPT2  = idxP.get(t2Date);

    // ─── Power sheet ────────────────────────────────────────────────────────
    const genD  = numVal(wsP, rP, 64),  genM  = numVal(wsP, rP, 66),  genY  = numVal(wsP, rP, 67);
    const avgD  = numVal(wsP, rP, 68),  avgM  = numVal(wsP, rP, 69),  avgY  = numVal(wsP, rP, 70);
    const plfD  = numVal(wsP, rP, 71),  plfM  = numVal(wsP, rP, 72),  plfY  = numVal(wsP, rP, 73);
    const expD  = numVal(wsP, rP, 77),  expM  = numVal(wsP, rP, 78),  expY  = numVal(wsP, rP, 79);
    const impD  = numVal(wsP, rP, 80),  impM  = numVal(wsP, rP, 81),  impY  = numVal(wsP, rP, 82);
    const netD  = numVal(wsP, rP, 83),  netM  = numVal(wsP, rP, 84),  netY  = numVal(wsP, rP, 85);
    const apcD  = numVal(wsP, rP, 86),  apcM  = numVal(wsP, rP, 87),  apcY  = numVal(wsP, rP, 88);
    const apcPD = numVal(wsP, rP, 89),  apcPM = numVal(wsP, rP, 90),  apcPY = numVal(wsP, rP, 91);
    const freqMin = numVal(wsP, rP, 149), freqMax = numVal(wsP, rP, 150), freqAvg = numVal(wsP, rP, 151);
    const hogsRaw  = rawVal(wsP, rP, 152);  // Hours on Grid raw (may be Date or number)
    const pafSD  = numVal(wsP, rP, 122), pafSM  = numVal(wsP, rP, 123), pafSY  = numVal(wsP, rP, 124);
    const pafTD  = numVal(wsP, rP, 205), pafTM  = numVal(wsP, rP, 206), pafTY  = numVal(wsP, rP, 207);
    const foD    = numVal(wsP, rP, 158), foM    = numVal(wsP, rP, 159), foY    = numVal(wsP, rP, 160);
    const plnD   = numVal(wsP, rP, 161), plnM   = numVal(wsP, rP, 162), plnY   = numVal(wsP, rP, 163);
    const rsdD   = numVal(wsP, rP, 164), rsdM   = numVal(wsP, rP, 165), rsdY   = numVal(wsP, rP, 166);
    const dcSD   = numVal(wsP, rP, 101), dcSM   = numVal(wsP, rP, 102), dcSY   = numVal(wsP, rP, 103);
    const dcTD   = numVal(wsP, rP, 202), dcTM   = numVal(wsP, rP, 203), dcTY   = numVal(wsP, rP, 204);
    const sgPD   = numVal(wsP, rP, 104), sgPM   = numVal(wsP, rP, 105), sgPY   = numVal(wsP, rP, 106);
    const askM   = numVal(wsP, rP, 146), askY   = numVal(wsP, rP, 147);
    const demD   = numVal(wsP, rP, 143), demM   = numVal(wsP, rP, 144), demY   = numVal(wsP, rP, 145);
    const dcLPD  = numVal(wsP, rP, 128), dcLPM  = numVal(wsP, rP, 129), dcLPY  = numVal(wsP, rP, 130);
    const dcLMD  = numVal(wsP, rP, 131), dcLMM  = numVal(wsP, rP, 132), dcLMY  = numVal(wsP, rP, 133);
    const dcLRsn = strVal(wsP, rP, 148);
    // DSM values are stored in RUPEES in Power sheet → divide by 100000 for lacs
    const DSM_SCALE = 100000;
    const dsmND  = numVal(wsP, rP, 247), dsmNM  = numVal(wsP, rP, 249), dsmNY  = numVal(wsP, rP, 250);
    const dsmPD  = numVal(wsP, rP, 244), dsmPM  = numVal(wsP, rP, 245), dsmPY  = numVal(wsP, rP, 246);
    // col 240 = receivable daily (col 241 is often null); 242=MTD, 243=YTD
    const dsmRD  = numVal(wsP, rP, 240), dsmRM  = numVal(wsP, rP, 242), dsmRY  = numVal(wsP, rP, 243);
    // col 251 = coal saving daily (col 252 often null); 253=MTD, 254=YTD
    const dsmCD  = numVal(wsP, rP, 251), dsmCM  = numVal(wsP, rP, 253), dsmCY  = numVal(wsP, rP, 254);
    const majorRmk = strVal(wsP, rP, 168);

    // APC: prefer Excel pre-computed, fall back to import + (gen - export)
    const apcFinal = apcD ?? (impD != null && genD != null && expD != null ? impD + (genD - expD) : null);
    // APC%: Excel stores as fraction → × 100
    const apcPctD = apcPD != null ? apcPD * 100 : (genD > 0 && apcFinal != null ? (apcFinal / genD) * 100 : null);
    const apcPctM = apcPM != null ? apcPM * 100 : null;
    const apcPctY = apcPY != null ? apcPY * 100 : null;

    // ─── Perf sheet (T-2 for GHR/GCV) ──────────────────────────────────────
    const gcvD = numVal(wsPf, rPfT2, 6);
    const ghrD = numVal(wsPf, rPfT2, 10);
    const ghrRem = strVal(wsPf, rPfT2, 15);
    const avgT2 = numVal(wsP, rPT2, 68);

    // ─── Fuel & Ash sheet ───────────────────────────────────────────────────
    // SOC daily/MTD: formula cells often have no cached result — compute from raw LDO+HFO / gen
    const socRawD = numVal(wsF, rF, 23);
    const socRawM = numVal(wsF, rF, 24);
    const socY    = numVal(wsF, rF, 25);
    // SCC daily/MTD: same issue — compute from coal cons / gen (coal cons broken in this file → null)
    const sccRawD = numVal(wsF, rF, 33);
    const sccRawM = numVal(wsF, rF, 34);
    const sccY    = numVal(wsF, rF, 35);
    const ldoCnD = numVal(wsF, rF, 8),  ldoCnM = numVal(wsF, rF, 9),  ldoCnY = numVal(wsF, rF, 10);
    const hfoCnD = numVal(wsF, rF, 19), hfoCnM = numVal(wsF, rF, 20), hfoCnY = numVal(wsF, rF, 21);
    const coaCnD = numVal(wsF, rF, 29), coaCnM = numVal(wsF, rF, 30), coaCnY = numVal(wsF, rF, 31);
    const ldoRcD = numVal(wsF, rF, 2),  ldoRcM = numVal(wsF, rF, 3),  ldoRcY = numVal(wsF, rF, 4);
    const hfoRcD = numVal(wsF, rF, 13), hfoRcM = numVal(wsF, rF, 14), hfoRcY = numVal(wsF, rF, 15);
    const coaRcD = numVal(wsF, rF, 26), coaRcM = numVal(wsF, rF, 27), coaRcY = numVal(wsF, rF, 28);
    const ldoSkD = numVal(wsF, rF, 11);
    const hfoSkD = numVal(wsF, rF, 22);
    const coaSkD = numVal(wsF, rF, 32);
    const h2CnD  = numVal(wsF, rF, 36), h2CnM  = numVal(wsF, rF, 37), h2CnY  = numVal(wsF, rF, 38);
    const co2CnD = numVal(wsF, rF, 41), co2CnM = numVal(wsF, rF, 42), co2CnY = numVal(wsF, rF, 43);
    const n2CnD  = numVal(wsF, rF, 46), n2CnM  = numVal(wsF, rF, 47), n2CnY  = numVal(wsF, rF, 48);
    const h2SkD  = numVal(wsF, rF, 40);
    const co2SkD = numVal(wsF, rF, 45);
    const n2SkD  = numVal(wsF, rF, 50);
    const faUD   = numVal(wsF, rF, 60), faUM   = numVal(wsF, rF, 61), faUY   = numVal(wsF, rF, 62);
    const faDkD  = numVal(wsF, rF, 63), faDkM  = numVal(wsF, rF, 64), faDkY  = numVal(wsF, rF, 65);
    const baUD   = numVal(wsF, rF, 66), baUM   = numVal(wsF, rF, 67), baUY   = numVal(wsF, rF, 68);
    const baDkD  = numVal(wsF, rF, 69), baDkM  = numVal(wsF, rF, 70), baDkY  = numVal(wsF, rF, 71);
    const faGnD  = numVal(wsF, rF, 54), faGnM  = numVal(wsF, rF, 55), faGnY  = numVal(wsF, rF, 56);
    const baGnD  = numVal(wsF, rF, 57), baGnM  = numVal(wsF, rF, 58), baGnY  = numVal(wsF, rF, 59);
    // Silo from Lvl & Totalizer sheet
    const faSlD  = numVal(wsLT, rLT, 89);
    const baSlD  = numVal(wsLT, rLT, 109);

    // ─── Water sheet ────────────────────────────────────────────────────────
    const dmCkD  = numVal(wsW, rW, 9),  dmCkM  = numVal(wsW, rW, 10), dmCkY  = numVal(wsW, rW, 11);
    const dmTD   = numVal(wsW, rW, 5),  dmTM   = numVal(wsW, rW, 6),  dmTY   = numVal(wsW, rW, 7);
    const swcD   = numVal(wsW, rW, 21), swcM   = numVal(wsW, rW, 22), swcY   = numVal(wsW, rW, 23);
    const pwcD   = numVal(wsW, rW, 57), pwcM   = numVal(wsW, rW, 58), pwcY   = numVal(wsW, rW, 59);
    const seaD   = numVal(wsW, rW, 67), seaM   = numVal(wsW, rW, 68), seaY   = numVal(wsW, rW, 69);
    const idctD  = numVal(wsW, rW, 25), idctM  = numVal(wsW, rW, 26), idctY  = numVal(wsW, rW, 27);
    const swiD   = numVal(wsW, rW, 43), swiM   = numVal(wsW, rW, 44), swiY   = numVal(wsW, rW, 45);
    const oflD   = numVal(wsW, rW, 34), oflM   = numVal(wsW, rW, 35), oflY   = numVal(wsW, rW, 36);
    const dmGnD  = numVal(wsW, rW, 2),  dmGnM  = numVal(wsW, rW, 3),  dmGnY  = numVal(wsW, rW, 4);
    const fwGnD  = numVal(wsW, rW, 18), fwGnM  = numVal(wsW, rW, 19), fwGnY  = numVal(wsW, rW, 20);
    const dmSkD  = numVal(wsW, rW, 8);
    const swSkD  = numVal(wsW, rW, 24);

    // Specific Water: (SWI - Outfall) / GenMU / 1000
    const spWD = genD > 0 && swiD != null && oflD != null ? (swiD - oflD) / genD / 1000 : null;
    const spWM = (genM ?? 0) > 0 && swiM != null && oflM != null ? (swiM - oflM) / genM / 1000 : null;

    // SOC: prefer cached col 23, fallback = (LDO + HFO) / gen_mu  [unit: ml/kWh = KL/MU]
    const socD = socRawD ?? (genD > 0 && ldoCnD != null && hfoCnD != null ? (ldoCnD + hfoCnD) / genD : null);
    const socM = socRawM ?? null;
    // SCC: prefer cached col 33, fallback = coal_mt / (gen_mu * 1000)
    const sccD = sccRawD ?? (genD > 0 && coaCnD != null ? coaCnD / (genD * 1000) : null);
    const sccM = sccRawM ?? null;

    // ─── DC-SG sheet ────────────────────────────────────────────────────────
    const sgDD  = numVal(wsDC, rDC, 17), sgDM  = numVal(wsDC, rDC, 18), sgDY  = numVal(wsDC, rDC, 19);
    const sgRD  = numVal(wsDC, rDC, 10), sgRM  = numVal(wsDC, rDC, 11), sgRY  = numVal(wsDC, rDC, 12);
    const sgTD  = numVal(wsDC, rDC, 3),  sgTM  = numVal(wsDC, rDC, 4),  sgTY  = numVal(wsDC, rDC, 5);

    // ─── URS sheet ──────────────────────────────────────────────────────────
    const ursD  = numVal(wsU, rU, 28),   ursM  = numVal(wsU, rU, 29),   ursY  = numVal(wsU, rU, 30);

    // ─── Header ─────────────────────────────────────────────────────────────
    const date = new Date(targetDate);
    const fyLabel = plant?.fy_label || '2025-2026';

    const report = {
        header: {
            title: `DAILY GENERATION REPORT — ${fyLabel}`,
            company: plant?.company_name || 'SEPC Power Pvt Ltd',
            plantName: plant?.name || 'TTPP',
            documentNumber: plant?.document_number || '',
            date: targetDate,
            dayName: date.toLocaleDateString('en-IN', { weekday: 'long' }),
            monthYear: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            fyLabel,
        },
        sections: [
            {
                title: "1️⃣ POWER",
                rows: [
                    { sn: "1.1", particulars: "Power Generation",                              uom: "MU",       daily: genD,  mtd: genM,   ytd: genY   },
                    { sn: "1.2", particulars: "Average Power Generation",                       uom: "MW",       daily: avgD,  mtd: avgM,   ytd: avgY   },
                    { sn: "1.3", particulars: "Total Export (GT)",                              uom: "MU",       daily: expD,  mtd: expM,   ytd: expY   },
                    { sn: "1.4", particulars: "Total Import (GT)",                              uom: "MU",       daily: impD,  mtd: impM,   ytd: impY   },
                    { sn: "1.5", particulars: "Net Export (GT Export − GT Import)",             uom: "MU",       daily: netD,  mtd: netM,   ytd: netY   },
                    { sn: "1.6", particulars: "Auxiliary Power Consumption (APC incl Import)",  uom: "MU",       daily: apcFinal, mtd: apcM,  ytd: apcY  },
                    { sn: "1.7", particulars: "APC %",                                          uom: "%",        daily: apcPctD, mtd: apcPctM, ytd: apcPctY },
                    { sn: "1.8", particulars: "Hours on Grid",                                  uom: "HH:MM",    daily: formatHoursOnGrid(hogsRaw), mtd: null, ytd: null },
                    { sn: "1.9", particulars: "Grid Frequency",                                 uom: "Hz",       daily: (freqMin || freqMax || freqAvg) ? `Min - ${freqMin ?? 0} Hz / Max - ${freqMax ?? 0} Hz / Avg - ${freqAvg ?? 0} Hz` : null, mtd: null, ytd: null },
                ]
            },
            {
                title: "2️⃣ PERFORMANCE",
                rows: [
                    { sn: "2.1",  particulars: "Plant Load Factor",                          uom: "%",        daily: plfD != null ? plfD * 100 : null,  mtd: plfM != null ? plfM * 100 : null,  ytd: plfY != null ? plfY * 100 : null  },
                    { sn: "2.2",  particulars: "Partial Loading",                             uom: "%",        daily: plfD != null && plfD > 0 ? Math.max(0, 1 - plfD) * 100 : null, mtd: plfM != null && plfM > 0 ? Math.max(0, 1 - plfM) * 100 : null, ytd: plfY != null && plfY > 0 ? Math.max(0, 1 - plfY) * 100 : null },
                    { sn: "2.3",  particulars: "Plant Availability Factor (SEPC)",            uom: "%",        daily: pafSD != null ? pafSD * 100 : null, mtd: pafSM != null ? pafSM * 100 : null, ytd: pafSY != null ? pafSY * 100 : null },
                    { sn: "2.4",  particulars: "Plant Availability Factor (TNPDCL)",          uom: "%",        daily: pafTD != null ? pafTD * 100 : null, mtd: pafTM != null ? pafTM * 100 : null, ytd: pafTY != null ? pafTY * 100 : null },
                    { sn: "2.5",  particulars: "Plant Outage – Forced",                       uom: "Count",    daily: foD,   mtd: foM,   ytd: foY   },
                    { sn: "2.6",  particulars: "Plant Outage – Planned",                      uom: "Count",    daily: plnD,  mtd: plnM,  ytd: plnY  },
                    { sn: "2.7",  particulars: "Plant Outage – RSD",                          uom: "Count",    daily: rsdD,  mtd: rsdM,  ytd: rsdY  },
                    { sn: "2.8",  particulars: "Specific Oil Consumption",                    uom: "ml/kWh",   daily: socD,  mtd: socM,  ytd: socY   },
                    { sn: "2.9",  particulars: "Specific Coal Consumption",                   uom: "kg/kWh",   daily: sccD,  mtd: sccM,  ytd: sccY   },
                    { sn: "2.10", particulars: `GHR (As Fired) as on ${t2Label}`,             uom: "kCal/kWh", daily: ghrD != null && avgT2 != null ? `${ghrD.toFixed(2)} / ${avgT2.toFixed(2)} MW` : (avgT2 != null ? `N/A / ${avgT2.toFixed(2)} MW` : null), mtd: null, ytd: null },
                    { sn: "2.11", particulars: "GHR Remarks",                                 uom: "Text",     daily: ghrRem, mtd: null, ytd: null },
                    { sn: "2.12", particulars: `GCV (As Fired) as on ${t2Label}`,             uom: "kCal/kg",  daily: gcvD,  mtd: null,  ytd: null  },
                ]
            },
            {
                title: "3️⃣ CONSUMPTION & STOCK",
                rows: [
                    { sn: "3.1",  particulars: "LDO Consumption",                          uom: "KL",  daily: ldoCnD, mtd: ldoCnM, ytd: ldoCnY },
                    { sn: "3.2",  particulars: "HFO Consumption",                          uom: "KL",  daily: hfoCnD, mtd: hfoCnM, ytd: hfoCnY },
                    { sn: "3.3",  particulars: "Coal Consumption",                         uom: "MT",  daily: coaCnD, mtd: coaCnM, ytd: coaCnY },
                    { sn: "3.4",  particulars: "LDO Receipt",                              uom: "KL",  daily: ldoRcD, mtd: ldoRcM, ytd: ldoRcY },
                    { sn: "3.5",  particulars: "HFO Receipt",                              uom: "KL",  daily: hfoRcD, mtd: hfoRcM, ytd: hfoRcY },
                    { sn: "3.6",  particulars: "Coal Receipt",                             uom: "MT",  daily: coaRcD, mtd: coaRcM, ytd: coaRcY },
                    { sn: "3.7",  particulars: "LDO Total / Usable Stock",                 uom: "KL",  daily: ldoSkD, mtd: null,   ytd: null   },
                    { sn: "3.8",  particulars: "HFO Total / Usable Stock",                 uom: "KL",  daily: hfoSkD, mtd: null,   ytd: null   },
                    { sn: "3.9",  particulars: "Coal Stock",                               uom: "MT",  daily: coaSkD, mtd: null,   ytd: null   },
                    { sn: "3.10", particulars: "DM Water Consumption (Cycle Makeup)",      uom: "m³",  daily: dmCkD,  mtd: dmCkM,  ytd: dmCkY  },
                    { sn: "3.11", particulars: "Total DM Water Consumption (Plant)",        uom: "m³",  daily: dmTD,   mtd: dmTM,   ytd: dmTY   },
                    { sn: "3.12", particulars: "Service Water Consumption",                uom: "m³",  daily: swcD,   mtd: swcM,   ytd: swcY   },
                    { sn: "3.13", particulars: "Potable Water Consumption",                uom: "m³",  daily: pwcD,   mtd: pwcM,   ytd: pwcY   },
                    { sn: "3.14", particulars: "Sea Water Consumption",                    uom: "m³",  daily: seaD,   mtd: seaM,   ytd: seaY   },
                    { sn: "3.15", particulars: "H₂ Consumption",                          uom: "Nos", daily: h2CnD,  mtd: h2CnM,  ytd: h2CnY  },
                    { sn: "3.16", particulars: "CO₂ Consumption",                         uom: "Nos", daily: co2CnD, mtd: co2CnM, ytd: co2CnY },
                    { sn: "3.17", particulars: "N₂ Consumption",                          uom: "Nos", daily: n2CnD,  mtd: n2CnM,  ytd: n2CnY  },
                    { sn: "3.18", particulars: "H₂ Stock",                                uom: "Nos", daily: h2SkD,  mtd: null,   ytd: null   },
                    { sn: "3.19", particulars: "CO₂ Stock",                               uom: "Nos", daily: co2SkD, mtd: null,   ytd: null   },
                    { sn: "3.20", particulars: "N₂ Stock",                                uom: "Nos", daily: n2SkD,  mtd: null,   ytd: null   },
                ]
            },
            {
                title: "4️⃣ POWER SCHEDULE",
                rows: [
                    { sn: "4.1",  particulars: "Declared Capacity (SEPC)",          uom: "MU",  daily: dcSD,  mtd: dcSM,  ytd: dcSY  },
                    { sn: "4.2",  particulars: "Declared Capacity (TNPDCL)",         uom: "MU",  daily: dcTD,  mtd: dcTM,  ytd: dcTY  },
                    { sn: "4.3",  particulars: "Schedule Generation (SG – PPA)",     uom: "MU",  daily: sgPD,  mtd: sgPM,  ytd: sgPY  },
                    { sn: "4.4",  particulars: "Schedule Generation (SG – DAM)",     uom: "MU",  daily: sgDD,  mtd: sgDM,  ytd: sgDY  },
                    { sn: "4.5",  particulars: "Schedule Generation (SG – RTM)",     uom: "MU",  daily: sgRD,  mtd: sgRM,  ytd: sgRY  },
                    { sn: "4.6",  particulars: "Total Schedule Generation",           uom: "MU",  daily: sgTD,  mtd: sgTM,  ytd: sgTY  },
                    { sn: "4.7",  particulars: "Asking Rate to Achieve 80% DC",      uom: "MW",  daily: null,  mtd: askM,  ytd: askY  },
                    { sn: "4.8",  particulars: "Deemed Generation – DG (TB + RSD)", uom: "MU",  daily: demD,  mtd: demM,  ytd: demY  },
                    { sn: "4.9",  particulars: "DC Loss (Capacity − DC SEPC)",       uom: "%",   daily: dcLPD != null ? dcLPD * 100 : null, mtd: dcLPM != null ? dcLPM * 100 : null, ytd: dcLPY != null ? dcLPY * 100 : null },
                    { sn: "4.10", particulars: "DC Loss Reason – Daily",             uom: "Text", daily: dcLRsn, mtd: null, ytd: null },
                ]
            },
            {
                title: "5️⃣ ASH",
                rows: [
                    { sn: "5.1", particulars: "Fly Ash to User",               uom: "MT", daily: faUD,  mtd: faUM,  ytd: faUY  },
                    { sn: "5.2", particulars: "Fly Ash to Dyke / Internal",    uom: "MT", daily: faDkD, mtd: faDkM, ytd: faDkY },
                    { sn: "5.3", particulars: "Bottom Ash to User",            uom: "MT", daily: baUD,  mtd: baUM,  ytd: baUY  },
                    { sn: "5.4", particulars: "Bottom Ash to Dyke / Internal", uom: "MT", daily: baDkD, mtd: baDkM, ytd: baDkY },
                    { sn: "5.5", particulars: "Fly Ash Generated",             uom: "MT", daily: faGnD, mtd: faGnM, ytd: faGnY },
                    { sn: "5.6", particulars: "Bottom & Eco Ash Generated",    uom: "MT", daily: baGnD, mtd: baGnM, ytd: baGnY },
                    { sn: "5.7", particulars: "Fly Ash in Silo",               uom: "MT", daily: faSlD, mtd: null,  ytd: null  },
                    { sn: "5.8", particulars: "Bottom Ash in Silo",            uom: "MT", daily: baSlD, mtd: null,  ytd: null  },
                ]
            },
            {
                title: "6️⃣ WATER",
                rows: [
                    { sn: "6.1", particulars: "IDCT Make Up (Sea Water)",                  uom: "m³",     daily: idctD, mtd: idctM, ytd: idctY },
                    { sn: "6.2", particulars: "SWI Flow",                                  uom: "m³",     daily: swiD,  mtd: swiM,  ytd: swiY  },
                    { sn: "6.3", particulars: "Outfall (CT Blowdown & WTP Reject)",        uom: "m³",     daily: oflD,  mtd: oflM,  ytd: oflY  },
                    { sn: "6.4", particulars: "Specific Water Consumption",                uom: "m³/MWh", daily: spWD,  mtd: spWM,  ytd: null  },
                    { sn: "6.5", particulars: "DM Water Generation",                       uom: "m³",     daily: dmGnD, mtd: dmGnM, ytd: dmGnY },
                    { sn: "6.6", particulars: "Filtered / Service Water Generation",       uom: "m³",     daily: fwGnD, mtd: fwGnM, ytd: fwGnY },
                    { sn: "6.7", particulars: "DM Water Total / Usable Stock",             uom: "m³",     daily: dmSkD, mtd: null,  ytd: null  },
                    { sn: "6.8", particulars: "Service Water Total / Usable Stock",        uom: "m³",     daily: swSkD, mtd: null,  ytd: null  },
                ]
            },
            {
                title: "7️⃣ DSM (Till Date)",
                rows: [
                    { sn: "7.1", particulars: "DSM Net Profit",                    uom: "Lacs", daily: dsmND != null ? dsmND / DSM_SCALE : null, mtd: dsmNM != null ? dsmNM / DSM_SCALE : null, ytd: dsmNY != null ? dsmNY / DSM_SCALE : null },
                    { sn: "7.2", particulars: "DSM Payable by SEPC",               uom: "Lacs", daily: dsmPD != null ? dsmPD / DSM_SCALE : null, mtd: dsmPM != null ? dsmPM / DSM_SCALE : null, ytd: dsmPY != null ? dsmPY / DSM_SCALE : null },
                    { sn: "7.3", particulars: "DSM Receivable by SEPC",            uom: "Lacs", daily: dsmRD != null ? dsmRD / DSM_SCALE : null, mtd: dsmRM != null ? dsmRM / DSM_SCALE : null, ytd: dsmRY != null ? dsmRY / DSM_SCALE : null },
                    { sn: "7.4", particulars: "DSM Coal Saving / (+Loss) by SEPC", uom: "Lacs", daily: dsmCD != null ? dsmCD / DSM_SCALE : null, mtd: dsmCM != null ? dsmCM / DSM_SCALE : null, ytd: dsmCY != null ? dsmCY / DSM_SCALE : null },
                ]
            },
            {
                title: "8️⃣ URS PROFIT / LOSS",
                rows: [
                    { sn: "8.1", particulars: "URS Net Profit", uom: "Lacs", daily: ursD, mtd: ursM, ytd: ursY },
                ]
            },
            {
                title: "9️⃣ DC LOSS B/U (Capacity – DC TNPDCL)",
                rows: [
                    { sn: "9.1", particulars: "DC Loss MU",  uom: "MU / %", daily: dcLMD != null ? `${dcLMD} / ${dcLPD != null ? (dcLPD*100).toFixed(2) : 0}%` : null, mtd: null, ytd: null },
                ]
            },
            {
                title: "🔟 ACTIVITIES / REMARKS",
                rows: [
                    { sn: "10.1", particulars: "Major Activities", uom: "Text", daily: majorRmk, mtd: null, ytd: null },
                    { sn: "10.2", particulars: "Remarks",           uom: "Text", daily: null,     mtd: null, ytd: null },
                    { sn: "10.3", particulars: "Observations",      uom: "Text", daily: null,     mtd: null, ytd: null },
                ]
            },
        ],
        meta: {
            submissionStatus: [],
            generatedAt: new Date().toISOString(),
            plantId: plant?.id,
            targetDate,
            source: 'excel',
        },
    };

    // Round numeric values to 4 decimal places
    function processNumbers(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'number') return Number(obj.toFixed(4));
        if (Array.isArray(obj)) return obj.map(processNumbers);
        if (typeof obj === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(obj)) out[k] = processNumbers(v);
            return out;
        }
        return obj;
    }

    report.sections = processNumbers(report.sections);
    return report;
}

module.exports = { assembleTtppExcelDGR };
