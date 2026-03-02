const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '../../DGR FY 2025-20261 - V1 (1).xlsx'));
const ws = wb.Sheets['Fuel & Ash'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log("--- ROW 3 ---");
data[2].forEach((val, i) => { if (val) console.log(i, val); });

console.log("\n--- ROW 4 ---");
data[3].forEach((val, i) => { if (val) console.log(i, val); });

console.log("\n--- ROW 10 (2025-04-05) ---");
data[10].forEach((val, i) => { if (val) console.log(i, val); });
