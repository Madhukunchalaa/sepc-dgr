const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

const mapping = [];
for (let r = 7; r <= 30; r++) {
    const sn = dgr['A' + r] ? dgr['A' + r].v : '';
    const part = dgr['C' + r] ? dgr['C' + r].v : '';
    const formula = dgr['E' + r] ? dgr['E' + r].f : '';
    const match = (formula || '').match(/,(\d+),FALSE/);
    const index = match ? parseInt(match[1]) : null;
    if (sn || part) {
        mapping.push({ row: r, sn, part, index });
    }
}
console.log(JSON.stringify(mapping, null, 2));
