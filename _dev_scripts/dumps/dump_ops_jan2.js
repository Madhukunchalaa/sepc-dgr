const xlsx = require('xlsx');
const fs = require('fs');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file);
const ops = wb.Sheets['Ops Input'];

let out = "Row | Description | JU (Jan 2) Value\n";
for (let r = 1; r <= 150; r++) {
    const desc = ops['C' + r] ? ops['C' + r].v : '';
    const val = ops['JU' + r] ? ops['JU' + r].v : '';
    if (desc || val) {
        out += `${r} | ${desc} | ${val}\n`;
    }
}

fs.writeFileSync('ops_input_jan2.txt', out);
console.log("Saved to ops_input_jan2.txt");
