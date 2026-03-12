const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

for (let r = 7; r <= 30; r++) {
    const sn = dgr['A' + r] ? dgr['A' + r].v : '';
    const part = dgr['C' + r] ? dgr['C' + r].v : '';
    const formula = dgr['E' + r] ? dgr['E' + r].f : '';
    console.log(`${r} | SN ${sn} | ${part} | Formula: ${formula}`);
}
