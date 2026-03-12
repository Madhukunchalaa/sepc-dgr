const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file);
const cal = wb.Sheets['24 cal'];

const screenshotValues = {
    1: 6.0,
    2: 0.4,
    3: 0.5,
    4: 5.0,
    5: 5.5,
    6: 6.0,
    7: 5.5,
    9: 5.0
};

console.log("----- SEARCHING FOR SCREENSHOT VALUES IN 24 CAL -----");
const range = xlsx.utils.decode_range(cal['!ref']);

for (let c = range.s.c; c <= range.e.c; c++) {
    const col = xlsx.utils.encode_col(c);
    const dateCell = cal[col + '1'];
    if (!dateCell || !dateCell.v) continue;

    // Check row indices we know from HLOOKUP
    const v1 = cal[col + '68'] ? cal[col + '68'].v : null;
    const v2 = cal[col + '56'] ? cal[col + '56'].v : null;
    const v4 = cal[col + '27'] ? cal[col + '27'].v : null;
    const v5 = cal[col + '32'] ? cal[col + '32'].v : null;
    const v9 = cal[col + '24'] ? cal[col + '24'].v : null;

    // Rounding to 1 decimal place to match screenshot style
    const r = (v) => v !== null ? (Math.round((v / 1000) * 10) / 10).toFixed(1) : 'N/A';

    if (r(v5) == "5.5" && r(v9) == "5.0") {
        console.log(`Column ${col} Date ${dateCell.v} (${xlsx.SSF.format('dd-mmm-yy', dateCell.v)}) matches SN 5 (5.5) and SN 9 (5.0)`);
        console.log(`  SN 1 (Row 68): ${r(v1)} (Expected 6.0)`);
        console.log(`  SN 2 (Row 56): ${r(v2)} (Expected 0.4)`);
        console.log(`  SN 4 (Row 27): ${r(v4)} (Expected 5.0)`);
    }
}
