const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

function getValF(sheetName, cell) {
    const s = wb.Sheets[sheetName];
    if (!s || !s[cell]) return 'Not found';
    return s[cell].f ? `Formula: ${s[cell].f}` : `Value: ${s[cell].v}`;
}

console.log('--- SOC Formula Deep Dive ---');
// Daily SOC is in DGR Row 23 (K23)
console.log('DGR K23 (Daily SOC):', getValF('DGR', 'K23'));

// K23 points to Power!FJ1. Let's look at Power FJ1.
console.log('Power FJ1:', getValF('Power', 'FJ1'));

// Okay, it's probably grabbing the specific row. Let's look at Power sheet Row 8 (which is April 1 2025)
// Let's search for "SOC" or specific oil consumption in the Power sheet headers

const pSheet = wb.Sheets['Power'];
const data = XLSX.utils.sheet_to_json(pSheet, { header: 1 });
console.log("\nPower Headers for Oil / SOC (Row 3-5)");
for (let r = 3; r <= 6; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
        if (String(row[c]).toLowerCase().includes('soc') || String(row[c]).toLowerCase().includes('specific oil')) {
            console.log(`Row ${r}, Col ${c} (${XLSX.utils.encode_col(c)}): ${row[c]}`);
        }
    }
}

// Let's print Power!FI8 and Power!FJ8
console.log("\nPower FI8:", getValF('Power', 'FI8'));
console.log("Power FJ8:", getValF('Power', 'FJ8'));

// The formula for Power!FI8 is: =IFERROR(IF(H8="","",('Fuel & Ash'!K7+'Fuel & Ash'!V7)/BL8/1000),"")
//   'Fuel & Ash'!K7 = LDO Cons (KL)
//   'Fuel & Ash'!V7 = HFO Cons (KL) -- wait, V is 21. Let's check Fuel & Ash headers
// Let's print Fuel & Ash headers for K and V
console.log("\nFuel & Ash Columns K and V (Row 4):");
console.log("K:", getValF('Fuel & Ash', 'K4'), "V:", getValF('Fuel & Ash', 'V4'));

console.log("\nSo SOC (ml/kWh) = (LDO Cons KL + HFO Cons KL) / (Generation MU) ");
