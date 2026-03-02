const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['DGR'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
        const val = String(row[c]).toLowerCase();
        if (val.includes('coal') || val.includes('ldo') || val.includes('hfo')) {
            console.log(`Label at [${r}, ${c}]: '${row[c]}'`);
            console.log(`  Adjacent rights: [${r}, ${c + 1}]=${row[c + 1]}, [${r}, ${c + 2}]=${row[c + 2]}, [${r}, ${c + 3}]=${row[c + 3]}, [${r}, ${c + 4}]=${row[c + 4]}`);
            console.log(`  Adjacent belows: [${r + 1}, ${c}]=${data[r + 1]?.[c]}, [${r + 2}, ${c}]=${data[r + 2]?.[c]}`);
        }
    }
}
