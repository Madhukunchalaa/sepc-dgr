const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const faData = XLSX.utils.sheet_to_json(wb.Sheets['Fuel & Ash'], { header: 1 });

for (let r = 300; r <= 316; r++) {
    const row = faData[r] || [];
    if (!row[0]) continue;
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    if (!dateObj) continue;
    const dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;

    console.log(`[${dateStr}] Row ${r}: LDO(R:${row[1]}, C:${row[7]}) | HFO(R:${row[12]}, C:${row[18]}) | Coal(R:${row[25]}, C:${row[28]})`);
}
