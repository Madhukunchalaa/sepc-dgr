const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const opsSheet = wb.Sheets['Ops Input'];

console.log("----- OPS INPUT ORIENTATION CHECK -----");
// Check first 5 rows and 5 columns
for (let r = 1; r <= 10; r++) {
    let rowTxt = `Row ${r}: `;
    for (let c = 0; c < 10; c++) {
        const colLetter = xlsx.utils.encode_col(c);
        const cell = opsSheet[colLetter + r];
        rowTxt += `[${colLetter}]: ${cell ? cell.v : 'EMPTY'} | `;
    }
    console.log(rowTxt);
}

console.log("\n----- 24 CAL SHEET E33 FORMULA -----");
const calSheet = wb.Sheets['24 cal'];
const e33 = calSheet['E33'];
if (e33) {
    console.log("E33 Formula:", e33.f);
    console.log("E33 Value:", e33.v);
}

// Find where E3 in '24 cal' comes from (the date)
console.log("24 cal E3 (Date?):", calSheet['E3'] ? calSheet['E3'].v : 'N/A');
