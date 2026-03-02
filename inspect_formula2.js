const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

function getValF(sheetName, cell) {
    const s = wb.Sheets[sheetName];
    if (!s || !s[cell]) return 'Not found';
    return s[cell].f ? `Formula: ${s[cell].f}` : `Value: ${s[cell].v}`;
}

// Specific Coal Consumption Daily is typically computed somewhere. Let's find it.
console.log('--- Specific Coal Consumption ---');
console.log('DGR K28 (Daily):', getValF('DGR', 'K28'));
console.log('DGR L28 (MTD):', getValF('DGR', 'L28'));

console.log('\n--- Specific Oil Consumption ---');
console.log('DGR K23 (Daily):', getValF('DGR', 'K23'));

console.log('\n--- Gross Heat Rate ---');
console.log('DGR P26 (GHRCell?):', getValF('DGR', 'P26'));
console.log('DGR M26:', getValF('DGR', 'M26'));

// Sometimes it's better to search the Detailed DGR for formulas
const pdSheet = wb.Sheets['Detailed DGR'];
console.log('\n--- Detailed DGR Sheet (Row 3, 2025-04-01) ---');
console.log('Power Generation:', getValF('Detailed DGR', 'B4'));
console.log('Coal Cons:', getValF('Detailed DGR', 'BB4')); // Check where Coal Cons is
console.log('SCC:', getValF('Detailed DGR', 'BC4')); 
