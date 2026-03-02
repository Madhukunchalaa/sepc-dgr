const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const sheetName = 'Fuel & Ash';
const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

console.log("Headers:");
for (let c = 0; c < 50; c++) {
    const h2 = data[2]?.[c] || '';
    const h3 = data[3]?.[c] || '';
    const h4 = data[4]?.[c] || '';
    if (h2 || h3 || h4) {
        console.log(`Col ${c}: ${h2} | ${h3} | ${h4}`);
    }
}

console.log("\nSample Data (Rows 6-8):");
for (let r = 6; r <= 8; r++) {
    const row = data[r] || [];
    const dateObj = XLSX.SSF.parse_date_code(row[0]);
    const dateStr = dateObj ? `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}` : 'Invalid';
    console.log(`Row ${r} [${dateStr}]:`);
    for (let c = 0; c < 50; c++) {
        if (row[c] !== undefined && row[c] !== 0 && row[c] !== '') {
            console.log(`  Col ${c}: ${row[c]}`);
        }
    }
}
