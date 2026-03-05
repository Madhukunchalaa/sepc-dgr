const XLSX = require('xlsx');
const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
const ws = wb.Sheets['Water'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
console.log('Water Sheet Headers:');
for (let c = 0; c < 35; c++) {
    if (data[2] && data[2][c]) console.log(`Col ${c}: ${data[2][c]}`);
    if (data[3] && data[3][c]) console.log(`Col ${c}: ${data[3][c]}`);
}
