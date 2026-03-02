const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);

console.log("Searching for GCV...");
for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    let found = false;
    for (let r = 0; r < Math.min(10, data.length); r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
            if (String(row[c]).toLowerCase().includes('gcv')) {
                console.log(`Found GCV in sheet '${sheetName}', Row ${r}, Col ${c}: ${row[c]}`);
                // Print surrounding context safely
                console.log(`  Row Context: ${row.slice(Math.max(0, c - 2), c + 5).join(' | ')}`);
                found = true;
            }
        }
    }
}
