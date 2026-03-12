const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

const rows = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38];
rows.forEach(r => {
    const label = cal['B' + r] ? cal['B' + r].v : 'N/A';
    const cell = cal['E' + r];
    console.log(`--- Row ${r} ---`);
    console.log(`Label: ${label}`);
    console.log(`Formula: ${cell ? cell.f : 'N/A'}`);
    console.log(`Value: ${cell ? cell.v : 'N/A'}`);
});
