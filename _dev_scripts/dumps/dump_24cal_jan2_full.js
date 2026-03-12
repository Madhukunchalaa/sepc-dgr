const xlsx = require('xlsx');
const fs = require('fs');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file);
const cal = wb.Sheets['24 cal'];
const JU = 'JU'; // Jan 2, 2026

let out = "Row | Label (Col B) | JU Value | Value/1000\n";
out += "---|---|---|---\n";

for (let r = 1; r <= 157; r++) {
    const label = cal['B' + r] ? cal['B' + r].v : 'N/A';
    const val = cal[JU + r] ? cal[JU + r].v : 0;
    const mu = (typeof val === 'number') ? (val / 1000).toFixed(4) : 'N/A';
    out += `${r} | ${label} | ${val} | ${mu}\n`;
}

fs.writeFileSync('24cal_jan2_all_rows.txt', out);
console.log("Written to 24cal_jan2_all_rows.txt");
