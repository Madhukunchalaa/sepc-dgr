const XLSX = require('xlsx');

const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
const ws = wb.Sheets['Power'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const r2 = data[2] || []; // Row 3
const r3 = data[3] || []; // Row 4
const r4 = data[4] || []; // Row 5

console.log('--- Columns 230 to 300 ---');
for (let c = 230; c <= 300; c++) {
    const v2 = String(r2[c] || '').trim();
    const v3 = String(r3[c] || '').trim();
    const v4 = String(r4[c] || '').trim();
    if (v2 || v3 || v4) {
        console.log(`Col ${c}: R3[${v2}] | R4[${v3}] | R5[${v4}]`);
    }
}
