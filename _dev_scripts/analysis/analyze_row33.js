const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const calSheet = wb.Sheets['24 cal'];

console.log("---- GROSS GEN FORMULA (ROW 33 in '24 cal') ----");
// Wait, looking at E8 formula from earlier: HLOOKUP(E3,'24 cal'!A1:NE157,33,FALSE)/1000
// Gross Generation is pulling from Row 33 of the '24 cal' sheet! 

const grossCell = calSheet['E33'];
if (grossCell) {
    console.log(`Gross Gen E33 Formula: ${grossCell.f}`);
    console.log(`Gross Gen E33 Value: ${grossCell.v}`);
}

console.log("\n---- NET EXPORT FORMULA (ROW 35 in '24 cal') ----");
// Assuming Net Export pulls from Row 35 based on typical structural layout
const exportCell = calSheet['E35'];
if (exportCell) {
    console.log(`Net Export E35 Formula: ${exportCell.f}`);
    console.log(`Net Export E35 Value: ${exportCell.v}`);
}

console.log("\n---- Aux Consumption ----");
for (let i = 30; i <= 40; i++) {
    const c = calSheet['B' + i];
    if (c && c.v) console.log(`Row B${i}: ${c.v}`);
}
