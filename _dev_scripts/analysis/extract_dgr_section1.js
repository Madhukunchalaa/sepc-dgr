const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

console.log("----- DGR SHEET SECTION 1 (GENERATION DETAILS) -----");

// Row 7 to 15 usually contains SN 1 to 9
const startRow = 7;
const endRow = 15;

for (let r = startRow; r <= endRow; r++) {
    const snCell = dgr['A' + r];
    const particCell = dgr['C' + r];
    const dailyCell = dgr['E' + r];
    const mtdCell = dgr['F' + r];
    const ytdCell = dgr['G' + r];

    console.log(`SN ${snCell ? snCell.v : '?'}: ${particCell ? particCell.v : '?'}`);
    if (dailyCell) {
        console.log(`  Daily: Value=${dailyCell.v} | Formula=${dailyCell.f || 'None'}`);
    }
    if (mtdCell) {
        console.log(`  MTD: Value=${mtdCell.v} | Formula=${mtdCell.f || 'None'}`);
    }
    if (ytdCell) {
        console.log(`  YTD: Value=${ytdCell.v} | Formula=${ytdCell.f || 'None'}`);
    }
}
