const XLSX = require('xlsx');

const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');

for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (let r = 0; r < Math.min(20, data.length); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
            const val = String(row[c] || '').toLowerCase();
            if (val.includes('urs')) {
                console.log(`Sheet: ${sheetName} | Row: ${r} | Col: ${c} | Value: ${val}`);
            }
        }
    }
}
