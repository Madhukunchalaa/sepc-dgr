const ExcelJS = require('exceljs');
const fs = require('fs');

async function extractHeaders(filePath) {
    let out = `\n============== FILE: ${filePath} ==============\n`;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    workbook.eachSheet((worksheet) => {
        out += `\n--- Sheet: ${worksheet.name} ---\n`;
        let count = 0;
        worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
            if (count < 20) {
                out += `Row ${rowNumber}: ` + JSON.stringify(row.values) + '\n';
                count++;
            }
        });
    });
    return out;
}

(async () => {
    try {
        let result = "";
        result += await extractHeaders('C:/Users/IE-Admin/Desktop/MIS REPORTS/Heat-rate report (BTG losses).xlsx');
        result += await extractHeaders('C:/Users/IE-Admin/Desktop/MIS REPORTS/Monthly Load record statement - Feb 2026.xlsx');
        result += await extractHeaders('C:/Users/IE-Admin/Desktop/MIS REPORTS/MOC documents/1. Modification Proposal Initiation Form.xlsx');
        fs.writeFileSync('output_utf8.txt', result, 'utf8');
        console.log("Done");
    } catch(e) {
        console.error(e);
    }
})();
