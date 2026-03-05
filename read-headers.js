const XLSX = require('xlsx');
const fs = require('fs');

function run() {
    const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
    const wsPower = wb.Sheets['Power'];
    const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

    const rowLabels = dataPower[2];
    let output = '';
    for (let j = 0; j < rowLabels.length; j++) {
        const lab = String(rowLabels[j] || '').trim();
        if (lab !== '') {
            output += `Col ${j}: ${lab.replace(/\r?\n|\r/g, ' ')}\n`;
        }
    }
    fs.writeFileSync('c:/tmp/headers.txt', output);
}
run();
