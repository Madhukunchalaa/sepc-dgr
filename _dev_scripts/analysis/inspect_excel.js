const XLSX = require('xlsx');

function run() {
    const filePath = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
    const wb = XLSX.readFile(filePath);
    const opsSheet = wb.Sheets['Ops Input'];
    const opsData = XLSX.utils.sheet_to_json(opsSheet, { header: 1 });

    const dates = opsData[0]; // Row 1

    // Find column for Jan 15, 2026 (approx)
    // Excel dates are numbers. Jan 15 2026 is around 46037
    let colIdx = -1;
    for (let c = 3; c < dates.length; c++) {
        if (typeof dates[c] === 'number') {
            const d = XLSX.SSF.parse_date_code(dates[c]);
            const dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            if (dateStr === '2026-01-15') {
                colIdx = c;
                break;
            }
        }
    }

    if (colIdx === -1) {
        console.log('Could not find column for 2026-01-15');
        return;
    }

    console.log(`Checking values for 2026-01-15 at column index ${colIdx}`);

    const rowsToCheck = [
        10, // hfo_receipt_mt (SN9)
        11, // hfo_supply_int_rdg (SN10)
        20, // lignite_vadallur_silo (SN19)
        114, // bfp1_kwh (SN113)
        127, // cac1_kwh (SN126)
    ];

    rowsToCheck.forEach(r => {
        const row = opsData[r];
        console.log(`Row ${r} (SN${r - 1 || '?'}):`, row ? row[colIdx] : 'MISSING');
    });
}

run();
