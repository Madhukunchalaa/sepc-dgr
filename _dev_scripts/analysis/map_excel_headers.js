const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const opsSheet = wb.Sheets['Ops Input'];

// Read the header row (typically row 3 or 4 in this master file)
// and map column letters to header text.
console.log("----- OPS INPUT HEADERS MAP -----");
const headersRow = 3; // Let's guess row 3, we can check row 4 if empty
for (let key in opsSheet) {
    const match = key.match(/^([A-Z]+)([0-9]+)$/);
    if (match && match[2] == headersRow) {
        const col = match[1];
        const val = opsSheet[key].v;
        console.log(`${col}: ${val}`);
    }
}

console.log("\n----- OPS INPUT ROW 4 -----");
for (let key in opsSheet) {
    const match = key.match(/^([A-Z]+)([0-9]+)$/);
    if (match && match[2] == 4) {
        const col = match[1];
        const val = opsSheet[key].v;
        console.log(`${col}: ${val}`);
    }
}

console.log("\n----- 24 CAL ROW 33 FORMULA DETAIL -----");
const calSheet = wb.Sheets['24 cal'];
const cellE33 = calSheet['E33'];
const cellE34 = calSheet['E34'];
const cellE35 = calSheet['E35'];
const cellE36 = calSheet['E36'];
const cellE37 = calSheet['E37'];
const cellE38 = calSheet['E38'];

console.log("E33 (Gross Gen?):", cellE33 ? cellE33.f : 'N/A');
console.log("E34 (Aux?):", cellE34 ? cellE34.f : 'N/A');
console.log("E35 (Export?):", cellE35 ? cellE35.f : 'N/A');
console.log("E36 (Import?):", cellE36 ? cellE36.f : 'N/A');
console.log("E37 (DC?):", cellE37 ? cellE37.f : 'N/A');
console.log("E38 (Deemed?):", cellE38 ? cellE38.f : 'N/A');
