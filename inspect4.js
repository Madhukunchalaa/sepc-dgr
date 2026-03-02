const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['DGR'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < 50; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
        if (typeof row[c] === 'number' && row[c] > 1000) {
            // Find the nearest string to the left
            let label = 'Unknown';
            for (let k = c - 1; k >= Math.max(0, c - 6); k--) {
                if (typeof row[k] === 'string' && row[k].length > 4) {
                    label = row[k];
                    break;
                }
            }
            console.log(`Row ${r}, Col ${c} = ${row[c]} | Nearest Label: ${label}`);
        }
    }
}
