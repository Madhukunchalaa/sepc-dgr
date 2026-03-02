const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const sheetName = 'Perf';
const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

console.log("Perf Headers (Rows 2-5):");
for (let r = 2; r <= 5; r++) {
    const row = data[r] || [];
    console.log(`Row ${r}:`, row.slice(0, 10).join(' | '));
}

console.log("\nSample Data (Rows 6-8):");
for (let r = 6; r <= 8; r++) {
    const row = data[r] || [];
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    const dateStr = dateObj ? `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}` : 'Invalid';
    console.log(`Row ${r} [${dateStr}]: ${row[0]} | GCV AR: ${row[1]} | GCV AF: ${row[5]}`);
}
