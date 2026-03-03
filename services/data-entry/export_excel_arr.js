const xlsx = require('xlsx');
const fs = require('fs');
const filePath = 'c:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx';
const workbook = xlsx.readFile(filePath, { cellDates: true });

function exportSheetArray(sheetName) {
    if (workbook.Sheets[sheetName]) {
        // use header: 1 to get an array of arrays (rows of cells)
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null });
        // export first 50 rows
        fs.writeFileSync(`${sheetName}_arr.json`, JSON.stringify(data.slice(0, 50), null, 2));
        console.log(`Exported ${sheetName} as array`);
    } else {
        console.log(`Sheet ${sheetName} not found`);
    }
}

exportSheetArray('DGR');
exportSheetArray('Power');
exportSheetArray('Water');
