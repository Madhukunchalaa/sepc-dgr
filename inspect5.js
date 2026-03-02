const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['DGR'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < 60; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
        if (typeof row[c] === 'number' && row[c] >= 13000 && row[c] <= 19000) {
            console.log(`Value ${row[c]} at [${r}, ${c}]`);
            // Print neighbors
            console.log(`Left context: ${row.slice(Math.max(0, c - 4), c).join(' | ')}`);
        }
    }
}
