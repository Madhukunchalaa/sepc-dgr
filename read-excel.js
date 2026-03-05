const XLSX = require('xlsx');

function run() {
    const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
    const wsPower = wb.Sheets['Power'];
    const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });

    const rowLabels = dataPower[2];
    for (let j = 0; j < rowLabels.length; j++) {
        const lab = String(rowLabels[j] || '').trim();
        if (lab.includes('Export') || lab.includes('Import') || lab.includes('APC')) {
            console.log(`Col ${j}: ${lab} = ${dataPower[48][j]}`);
        }
    }
}
run();
