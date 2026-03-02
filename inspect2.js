const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['DGR'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 25; r < 45; r++) {
    const row = data[r] || [];
    console.log(`Row ${r}:`, row.slice(0, 6));
}
