const xlsx = require('xlsx');

const filePath = 'c:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx';
const workbook = xlsx.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

const firstSheet = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheet];

const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 0 }); // read first few rows

console.log(`\n--- Output of ${firstSheet} (first 20 rows) ---`);
for (let i = 0; i < Math.min(20, data.length); i++) {
    console.log(data[i]);
}
