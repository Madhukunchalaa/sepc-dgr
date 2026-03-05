const XLSX = require('xlsx');

function run() {
    const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');

    // Check 'Fuel & Ash' sheet
    const wsFuel = wb.Sheets['Fuel & Ash'];
    if (wsFuel) {
        console.log('--- Fuel & Ash Sheet ---');
        const data = XLSX.utils.sheet_to_json(wsFuel, { header: 1 });
        const headers = data[2];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const cell0 = row?.[0];
            if (typeof cell0 === 'number') {
                const date = XLSX.SSF.parse_date_code(cell0);
                if (date.y === 2026 && date.m === 2 && date.d === 5) {
                    console.log(`Found Feb 5th in Fuel & Ash at Row ${i + 1}`);
                    row.forEach((val, idx) => {
                        if (val !== null && val !== undefined) {
                            console.log(`Col ${idx} (${headers[idx]}): ${val}`);
                        }
                    });
                }
            }
        }
    }

    // Check 'SAP' sheet
    const wsSAP = wb.Sheets['SAP'];
    if (wsSAP) {
        console.log('\n--- SAP Sheet ---');
        const data = XLSX.utils.sheet_to_json(wsSAP, { header: 1 });
        const headers = data[2];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const cell0 = row?.[0];
            if (typeof cell0 === 'number') {
                const date = XLSX.SSF.parse_date_code(cell0);
                if (date.y === 2026 && date.m === 2 && date.d === 5) {
                    console.log(`Found Feb 5th in SAP at Row ${i + 1}`);
                    row.forEach((val, idx) => {
                        if (val !== null && val !== undefined) {
                            console.log(`Col ${idx} (${headers?.[idx]}): ${val}`);
                        }
                    });
                }
            }
        }
    }
}
run();
