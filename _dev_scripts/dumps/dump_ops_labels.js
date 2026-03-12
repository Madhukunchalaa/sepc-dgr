const xlsx = require('xlsx');
const fs = require('fs');
const wb = xlsx.readFile('TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx');
const ops = wb.Sheets['Ops Input'];

let out = "";
const rows = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57];
rows.forEach(r => {
    out += `Row ${r} | ${ops['C' + r]?.v}\n`;
});

fs.writeFileSync('ops_labels.txt', out);
console.log("Written ops_labels.txt");
