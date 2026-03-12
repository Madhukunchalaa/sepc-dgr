const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file);
const cal = wb.Sheets['24 cal'];
const JU = 'JU'; // Jan 2, 2026

console.log("Row | Label from Column B | JU (Jan 2) Value");
console.log("---|---|---");
for (let r = 20; r <= 80; r++) {
    const label = cal['B' + r] ? cal['B' + r].v : 'N/A';
    const val = cal[JU + r] ? cal[JU + r].v : 'N/A';
    console.log(`${r} | ${label} | ${val}`);
}
