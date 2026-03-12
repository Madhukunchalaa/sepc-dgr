const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

console.log("Row | Label | Formula (Col E)");

for (let i = 1; i <= 100; i++) {
    const label = cal['B' + i] ? cal['B' + i].v : '';
    const formula = cal['E' + i] ? cal['E' + i].f : 'None';
    const value = cal['E' + i] ? cal['E' + i].v : 'None';
    console.log(`${i} | ${label} | ${formula} | ${value}`);
}
