const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

function getValF(sheetName, cell) {
    const s = wb.Sheets[sheetName];
    if (!s || !s[cell]) return 'Not found';
    return s[cell].f ? `Formula: ${s[cell].f}` : `Value: ${s[cell].v}`;
}

console.log('--- Deep Dive into Formulas ---');

// SCC Daily (Perf!H1) ?? Let's check Perf row 3
console.log('Perf M10 (GHR Daily):', getValF('Perf', 'I6'));
console.log('Perf N10:', getValF('Perf', 'J6'));

const faSheet = wb.Sheets['Fuel & Ash'];
console.log("\nFuel & Ash Row 6 (April 1, 2025):");
console.log('Coal Cons (AC6?):', getValF('Fuel & Ash', 'AC6'));
console.log('SCC Daily (AG6?):', getValF('Fuel & Ash', 'AG6'));

// Let's print out the headers + formulas for the first valid row of Fuel & Ash
const data = XLSX.utils.sheet_to_json(faSheet, { header: 1 });
console.log("\nFuel & Ash Columns 22 to 34 (Row 6)");
const row = data[6];
for (let c = 22; c <= 34; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    console.log(`Col ${c} (${colLetter}): ${row[c]}`, getValF('Fuel & Ash', `${colLetter}7`));
}

const perfSheet = wb.Sheets['Perf'];
const perfData = XLSX.utils.sheet_to_json(perfSheet, { header: 1 });
console.log("\nPerf Columns 1 to 15 (Row 6)");
const pRow = perfData[6];
for (let c = 1; c <= 15; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    console.log(`Col ${c} (${colLetter}): ${pRow[c]}`, getValF('Perf', `${colLetter}7`));
}
