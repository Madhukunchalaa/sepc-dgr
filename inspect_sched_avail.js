const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath);

const dgrSheet = wb.Sheets['DGR'];
const sapSheet = wb.Sheets['SAP'];

const dgr = XLSX.utils.sheet_to_json(dgrSheet, { header: 1 });
const sap = XLSX.utils.sheet_to_json(sapSheet, { header: 1 });

console.log('DGR header rows around scheduling section (rows 50-70):');
for (let r = 50; r <= 70; r++) {
  const row = dgr[r] || [];
  console.log(`Row ${r}:`, row.slice(0, 12));
}

console.log('\nSAP header rows (rows 2-6):');
for (let r = 2; r <= 6; r++) {
  const row = sap[r] || [];
  console.log(`Row ${r}:`, row.slice(0, 20));
}

