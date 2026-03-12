const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

const formulas = [];

for (let r = 7; r <= 15; r++) {
    formulas.push({
        sn: dgr['A' + r] ? dgr['A' + r].v : '',
        particulars: dgr['C' + r] ? dgr['C' + r].v : '',
        daily: dgr['E' + r] ? dgr['E' + r].f : 'None',
        mtd: dgr['F' + r] ? dgr['F' + r].f : 'None',
        ytd: dgr['G' + r] ? dgr['G' + r].f : 'None'
    });
}

console.log(JSON.stringify(formulas, null, 2));
