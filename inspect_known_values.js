const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);

const targetValues = [93, 91.464, 616.579, 430.05, 5403, 5515];

console.log("Searching for known fuel values...");
for (const sheetName of wb.SheetNames) {
    // Skip DGR since we know it's there
    if (sheetName === 'DGR') continue;

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        for (let c = 0; c < row.length; c++) {
            const val = row[c];
            if (typeof val === 'number') {
                for (const target of targetValues) {
                    if (Math.abs(val - target) < 0.001) {
                        console.log(`Found ${target} in ${sheetName} at [${r}, ${c}]`);
                        console.log(`  Row Context: ${row.slice(Math.max(0, c - 4), c + 4).join(' | ')}`);
                    }
                }
            }
        }
    }
}
