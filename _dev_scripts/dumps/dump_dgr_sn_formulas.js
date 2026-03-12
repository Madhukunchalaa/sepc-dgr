const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

console.log("----- DGR FORMULAS SN 1-9 -----");
for (let r = 5; r <= 15; r++) {
    const snCell = dgr['A' + r];
    const labelCell = dgr['C' + r];
    const dayCell = dgr['E' + r];

    const sn = snCell ? snCell.v : '';
    const label = labelCell ? labelCell.v : '';
    const formula = dayCell ? dayCell.f : '';
    const value = dayCell ? dayCell.v : '';

    console.log(`SN ${sn} | ${label} | F: ${formula} | V: ${value}`);
}

console.log("\n----- CELL E3 and E4 -----");
console.log(`E3: V=${dgr['E3'] ? dgr['E3'].v : ''} F=${dgr['E3'] ? dgr['E3'].f : ''}`);
console.log(`E4: V=${dgr['E4'] ? dgr['E4'].v : ''} F=${dgr['E4'] ? dgr['E4'].f : ''}`);
