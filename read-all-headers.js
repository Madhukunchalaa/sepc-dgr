const XLSX = require('xlsx');
const fs = require('fs');

function run() {
    const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
    let output = '';

    for (const sheetName of wb.SheetNames) {
        output += `\n\n=== SHEET: ${sheetName} ===\n`;
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        let headerRow = 2; // default
        if (sheetName === 'Water' || sheetName === 'Ash') headerRow = 2; // adjust based on sheet structure

        const rowLabels = data[headerRow] || [];
        for (let j = 0; j < rowLabels.length; j++) {
            const lab = String(rowLabels[j] || '').trim();
            if (lab !== '') {
                output += `Col ${j}: ${lab.replace(/\r?\n|\r/g, ' ')}\n`;
            }
        }
    }
    fs.writeFileSync('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\all-headers.txt', output);
}
run();
