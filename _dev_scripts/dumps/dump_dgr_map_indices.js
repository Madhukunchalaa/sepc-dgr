const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

console.log("SN | Label | DGR Row | 24 Cal Index | Value (E3 selected)");
for (let r = 5; r <= 30; r++) {
    const sn = dgr['A' + r] ? dgr['A' + r].v : '';
    const label = dgr['C' + r] ? dgr['C' + r].v : '';
    const formula = dgr['E' + r] ? dgr['E' + r].f : '';
    const val = dgr['E' + r] ? dgr['E' + r].v : '';

    // Extract index from HLOOKUP(E3,'24 cal'!A1:NE157,68,FALSE)
    const match = (formula || '').match(/,(\d+),/);
    const index = match ? match[1] : 'N/A';

    if (sn || label) {
        console.log(`${sn} | ${label} | ${r} | ${index} | ${val}`);
    }
}
