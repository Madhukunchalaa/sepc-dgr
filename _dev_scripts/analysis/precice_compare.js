const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const ops = wb.Sheets['Ops Input'];
const cal = wb.Sheets['24 cal'];
const JU = 'JU';

console.log("----- OPS INPUT (Col JU) -----");
[40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57].forEach(r => {
    const cell = ops[JU + r];
    console.log(`Ops Row ${r} | ${ops['C' + r]?.v || 'N/A'} | Val: ${cell ? cell.v : 'N/A'}`);
});

console.log("\n----- 24 CAL (Col JU) -----");
[24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40].forEach(r => {
    const cell = cal[JU + r];
    console.log(`Cal Row ${r} | ${cal['B' + r]?.v || 'N/A'} | Val: ${cell ? cell.v : 'N/A'} | F: ${cell ? cell.f : 'N/A'}`);
});
