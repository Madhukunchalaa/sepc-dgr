const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);

const faData = XLSX.utils.sheet_to_json(wb.Sheets['Fuel & Ash'], { header: 1 });
const perfData = XLSX.utils.sheet_to_json(wb.Sheets['Perf'], { header: 1 });

for (let r = 310; r <= 320; r++) {
    const row = faData[r] || [];
    const perfRow = perfData[r] || [];
    if (!row[0]) continue;
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    if (!dateObj) continue;
    const dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;

    if (dateStr === '2026-02-05') {
        console.log(`Matched 2026-02-05 at Row ${r}:`);
        console.log(`LDO (Receipt, Cons, Stock): ${row[1]} | ${row[7]} | ${row[10]}`);
        console.log(`HFO (Receipt, Cons, Stock): ${row[12]} | ${row[18]} | ${row[21]}`);
        console.log(`Coal (Receipt, Cons, Stock): ${row[25]} | ${row[28]} | ${row[31]}`);
        console.log(`GCV (AR, AF): ${perfRow[1]} | ${perfRow[5]}`);
    }
}
