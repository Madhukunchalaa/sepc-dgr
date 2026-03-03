const xlsx = require('xlsx');
const fs = require('fs');
const filePath = 'c:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx';
const workbook = xlsx.readFile(filePath, { cellDates: true });

function exportSheet(sheetName) {
    if (workbook.Sheets[sheetName]) {
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        fs.writeFileSync(`${sheetName}.json`, JSON.stringify(data.slice(0, 5), null, 2));
        console.log(`Exported ${sheetName}`);
    } else {
        console.log(`Sheet ${sheetName} not found`);
    }
}

exportSheet('Power');
exportSheet('Water');
exportSheet('Fuel & Ash');
exportSheet('DGR');
