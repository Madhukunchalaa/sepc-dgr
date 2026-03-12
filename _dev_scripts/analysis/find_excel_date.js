const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const ops = wb.Sheets['Ops Input'];

// Dates are typically in Row 1 or 2 as serial numbers
console.log("----- FINDING DATE COLUMN for Jan 2, 2026 -----");
const targetDate = new Date('2026-01-02');
const targetSerial = Math.floor((targetDate - new Date('1899-12-30')) / (1000 * 60 * 60 * 24));

console.log(`Target Date: 2026-01-02 | Serial: ${targetSerial}`);

for (let c = 0; c < 500; c++) {
    const col = xlsx.utils.encode_col(c);
    const cell = ops[col + '1']; // Trying row 1
    if (cell && cell.v == targetSerial) {
        console.log(`Found Jan 2, 2026 in Column ${col} (Row 1)`);
        break;
    }
    const cell2 = ops[col + '2']; // Trying row 2
    if (cell2 && cell2.v == targetSerial) {
        console.log(`Found Jan 2, 2026 in Column ${col} (Row 2)`);
        break;
    }
}
