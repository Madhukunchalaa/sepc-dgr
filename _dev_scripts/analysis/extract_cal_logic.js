const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

const rowsToExtract = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38];
const results = [];

rowsToExtract.forEach(r => {
    results.push({
        row: r,
        label: cal['B' + r] ? cal['B' + r].v : 'N/A',
        formula: cal['E' + r] ? cal['E' + r].f : 'N/A',
        value: cal['E' + r] ? cal['E' + r].v : 'N/A'
    });
});

console.log(JSON.stringify(results, null, 2));
