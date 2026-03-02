const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);

const sheetNames = ['Lvl & Totalizer', 'SAP', 'Since Inception'];

for (const sheetName of sheetNames) {
    if (!wb.Sheets[sheetName]) continue;
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`\n--- ${sheetName} Headers ---`);
    for (let r = 0; r < 5; r++) {
        const row = data[r] || [];
        console.log(`Row ${r}:`, row.slice(0, 15).join(' | '));
    }
}
