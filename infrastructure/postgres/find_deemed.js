const XLSX = require('xlsx');
const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    for (let r = 0; r < Math.min(data.length, 100); r++) {
        if (!data[r]) continue;
        for (let c = 0; c < data[r].length; c++) {
            const val = data[r][c];
            if (typeof val === 'number') {
                if (Math.abs(val - 1.37791) < 0.01 || Math.abs(val - 46.5847) < 0.1 || Math.abs(val - 123.47) < 0.1) {
                    console.log(`Found value ${val} in Sheet: ${sheetName}, Row: ${r}, Col: ${c} (ColName: ${data[2]?.[c] || 'N/A'})`);
                }
            }
        }
    }
}
