const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Detailed DGR'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log("Detailed DGR Headers (Rows 0-3):");
for (let r = 0; r < 4; r++) {
    console.log(`Row ${r}:`, (data[r] || []).slice(0, 15).join(' | '));
}

console.log("\nSample Data (Rows 310-316):");
for (let r = 310; r <= 316; r++) {
    const row = data[r] || [];
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    const dateStr = dateObj ? `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}` : row[0];

    console.log(`Row ${r} [${dateStr}]: LDO Rec: ${row[63]} | LDO Cons: ${row[54]} | HFO Rec: ${row[66]} | HFO Cons: ${row[57]}`);
}
