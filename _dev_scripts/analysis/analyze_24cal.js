const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const calSheet = wb.Sheets['24 cal'];
const opsSheet = wb.Sheets['Ops Input'];

console.log("----- 24 CAL SHEET ROW 24 (GROSS GEN) -----");

// Row 24 in '24 cal' sheet holds the calculated Gross Generation for each day.
// Days typically start in column B or C. Let's look at a few cells: C24, D24, E24
const cellsToCheck = ['C24', 'D24', 'E24', 'F24'];

cellsToCheck.forEach(c => {
    const cell = calSheet[c];
    if (cell) {
        console.log(`Cell ${c}: Value = ${cell.v} | Formula = ${cell.f || 'None'}`);
    }
});

console.log("\n----- 24 CAL SHEET ROW 33 (NET EXPORT - From formula 33) -----");
['C33', 'D33', 'E33', 'F33'].forEach(c => {
    const cell = calSheet[c];
    if (cell) {
        console.log(`Cell ${c}: Value = ${cell.v} | Formula = ${cell.f || 'None'}`);
    }
});
