const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];
const JU = 'JU';

console.log("----- 24 CAL Row 24-40 FORMULAS for JAN 2nd (Col JU) -----");
for (let r = 24; r <= 40; r++) {
    const cell = cal[JU + r];
    console.log(`Row ${r} | Formula: ${cell ? cell.f : 'N/A'} | Value: ${cell ? cell.v : 'N/A'}`);
}
