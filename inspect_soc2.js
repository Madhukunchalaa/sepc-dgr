const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

function getValF(sheetName, cell) {
    const s = wb.Sheets[sheetName];
    if (!s || !s[cell]) return 'Not found';
    return s[cell].f ? `Formula: ${s[cell].f}` : `Value: ${s[cell].v}`;
}

// Power FH8 is the daily SOC
console.log("Power FH8:", getValF('Power', 'FH8'));

// Ah, Fuel & Ash columns H and S
// H is LDO Cons (KL) - specifically Daily Cons.
// S is HFO Cons (KL) - specifically Daily Cons.
console.log("\nFuel & Ash Columns H and S (Row 4):");
console.log("H:", getValF('Fuel & Ash', 'H4'), "S:", getValF('Fuel & Ash', 'S4'));

console.log("\nSo SOC (ml/kWh) = (LDO Cons KL + HFO Cons KL) / (Generation MU)");
// Since 1 KL = 1000 L = 1,000,000 ml. And 1 MU = 1,000,000 kWh.
// So (KL) / (MU) precisely equals (ml / kWh). This checks out mathematically!

console.log("\n--- SUMMARY OF EXCEL FORMULAS ---");
console.log("1. SCC (kg/kWh) = (Coal Cons MT) / (Generation MU * 1000)");
console.log("   * Note: DB uses (Coal Cons MT * 1000) / (Export MU * 1000000) -> which is Coal Cons / (Export MU * 1000)");
console.log("2. SOC (ml/kWh) = (LDO Cons KL + HFO Cons KL) / (Generation MU)");
console.log("   * Note: SOC is NOT saved to the DB during the fuel upsert in our current code.");
console.log("3. GHR (kCal/kWh) = ((GCV_AF * Coal Cons MT) + ((LDO Cons KL + HFO Cons KL) * 10700)) / (Generation MU * 1000)");
console.log("   * Note: This is an engine calculation, not a DB column natively.");

