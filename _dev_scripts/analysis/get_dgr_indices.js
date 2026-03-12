const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

console.log("SN | Particulars | 24-cal Row Index");
for (let r = 7; r <= 15; r++) {
    const sn = dgr['A' + r] ? dgr['A' + r].v : '';
    const part = dgr['C' + r] ? dgr['C' + r].v : '';
    const formula = dgr['E' + r] ? dgr['E' + r].f : '';
    // Formula looks like HLOOKUP(E3,'24 cal'!A1:NE157, INDEX, FALSE)/1000
    const match = formula.match(/,(\d+),FALSE/);
    const index = match ? match[1] : 'N/A';
    console.log(`${sn} | ${part} | ${index}`);
}
