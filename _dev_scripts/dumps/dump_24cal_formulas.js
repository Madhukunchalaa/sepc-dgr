const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

for (let i = 20; i <= 50; i++) {
    const label = cal['B' + i] ? cal['B' + i].v : 'N/A';
    const cell = cal['E' + i];
    console.log(`Row ${i} | ${label}`);
    console.log(`  Formula: ${cell ? cell.f : 'N/A'}`);
    console.log(`  Value: ${cell ? cell.v : 'N/A'}`);
}
