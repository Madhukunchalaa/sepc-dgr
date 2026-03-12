const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

console.log("----- DGR SHEET TOP LAYOUT (Row 1-10) -----");
for (let r = 1; r <= 10; r++) {
    let rowTxt = `Row ${r}: `;
    for (let c = 0; c < 10; c++) {
        const col = xlsx.utils.encode_col(c);
        const cell = dgr[col + r];
        const val = cell ? cell.v : '';
        const formula = cell && cell.f ? ` [=${cell.f}]` : '';
        rowTxt += `${col}: ${val}${formula} | `;
    }
    console.log(rowTxt);
}
