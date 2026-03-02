const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const sapData = XLSX.utils.sheet_to_json(wb.Sheets['SAP'], { header: 1 });

for (let r = 310; r <= 316; r++) {
    const row = sapData[r] || [];
    if (!row[0]) continue;
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    if (!dateObj) continue;
    const dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;

    console.log(`[${dateStr}] SAP Row ${r}: Coal Cons(${row[9]}) | LDO(${row[12]}) | HFO(${row[13]}) | H2(${row[14]})`);
}
