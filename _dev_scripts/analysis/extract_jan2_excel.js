const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

console.log("----- FINDING DATE COLUMN in '24 cal' for Jan 2, 2026 -----");
const targetSerial = 46024; // Jan 2, 2026

let targetCol = null;
for (let c = 0; c < 500; c++) {
    const col = xlsx.utils.encode_col(c);
    const cell = cal[col + '1']; // Row 1 in 24 cal usually has serials
    if (cell && cell.v == targetSerial) {
        targetCol = col;
        console.log(`Found Jan 2, 2026 in 24 cal Column ${col}`);
        break;
    }
}

if (targetCol) {
    const rows = [24, 27, 30, 32, 33, 34, 35, 36, 37];
    console.log("\n----- 24 CAL VALUES FOR JAN 2 -----");
    rows.forEach(r => {
        const label = cal['B' + r] ? cal['B' + r].v : 'N/A';
        const val = cal[targetCol + r] ? cal[targetCol + r].v : 'N/A';
        console.log(`Row ${r} | ${label} | Value: ${val}`);
    });
}

const dgr = wb.Sheets['DGR'];
console.log("\n----- DGR SHEET SECTION 1 VALUES -----");
for (let r = 7; r <= 15; r++) {
    const sn = dgr['A' + r] ? dgr['A' + r].v : '';
    const part = dgr['C' + r] ? dgr['C' + r].v : '';
    const daily = dgr['E' + r] ? dgr['E' + r].v : 'N/A';
    const mtd = dgr['F' + r] ? dgr['F' + r].v : 'N/A';
    const ytd = dgr['G' + r] ? dgr['G' + r].v : 'N/A';
    console.log(`SN ${sn} | ${part} | Daily: ${daily} | MTD: ${mtd} | YTD: ${ytd}`);
}
