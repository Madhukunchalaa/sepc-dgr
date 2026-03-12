const xlsx = require('xlsx');
const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const ops = wb.Sheets['Ops Input'];

console.log("----- OPS INPUT LABELS (40-60) -----");
for (let i = 40; i <= 60; i++) {
    const label = ops['B' + i] ? ops['B' + i].v : 'N/A';
    console.log(`Row ${i}: ${label}`);
}

console.log("\n----- 24 CAL SHEET ROW DATA FOR E -----");
const cal = wb.Sheets['24 cal'];
for (let i = 30; i <= 40; i++) {
    const label = cal['B' + i] ? cal['B' + i].v : 'N/A';
    const cell = cal['E' + i];
    console.log(`Row ${i} label: ${label} | Value: ${cell ? cell.v : 'N/A'} | Formula: ${cell ? cell.f : 'N/A'}`);
}
