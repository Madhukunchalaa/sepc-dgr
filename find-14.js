const XLSX = require('xlsx');

function run() {
    const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');
    const wsFuel = wb.Sheets['Fuel & Ash'];
    const dataFuel = XLSX.utils.sheet_to_json(wsFuel, { header: 1, defval: null });

    const rowIdx = 48; // corresponds to 2025-06-11
    console.log("Excel Fuel Row 48:");
    const rowLabels = dataFuel[2];
    for (let j = 0; j < dataFuel[rowIdx].length; j++) {
        const val = dataFuel[rowIdx][j];
        if (val === 14 || val === '14') {
            console.log(`Found 14 at Col ${j}: ${rowLabels[j]}`);
        }
    }
}
run();
