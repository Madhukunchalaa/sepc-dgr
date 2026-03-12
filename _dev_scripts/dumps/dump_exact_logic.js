const xlsx = require('xlsx');
const fs = require('fs');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const cal = wb.Sheets['24 cal'];

let out = "Row | Label | Formula | Value\n";
out += "---|---|---|---\n";

for (let i = 19; i <= 50; i++) {
    const label = cal['B' + i] ? cal['B' + i].v : 'N/A';
    const cell = cal['E' + i];
    out += `${i} | ${label} | ${cell ? cell.f : 'N/A'} | ${cell ? cell.v : 'N/A'}\n`;
}

fs.writeFileSync('24cal_exact_logic.txt', out);
console.log("Written to 24cal_exact_logic.txt");
