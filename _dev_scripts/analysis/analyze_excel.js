const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true, cellStyles: true });
const dgrSheet = wb.Sheets['DGR'];

console.log("----- DGR SHEET CALCULATIONS STARTING ROW 19 -----");

// Generator calculations often start around row 9 or 19 in these DGR reports. Let's look for known output values (5.5, 5.04) or key text fields.
for (let key in dgrSheet) {
    const cell = dgrSheet[key];

    // Look for text matching "Gross" or "Auxiliary" or "Export" to orient ourselves
    if (cell && cell.v && typeof cell.v === 'string') {
        const text = cell.v.toLowerCase();
        if (text.includes('gross generation') || text.includes('auxiliary consumption') || text.includes('net export') || text.includes('deemed')) {
            console.log(`\nLabel Found at ${key}: ${cell.v}`);

            // Assume values are 1, 2, or 3 columns to the right (e.g. if label is B9, data is C9/D9/E9)
            const rowMatch = key.match(/\d+/);
            if (rowMatch) {
                const rowStr = rowMatch[0];
                const colsToLookAt = ['D', 'E', 'F', 'G', 'H'];
                colsToLookAt.forEach(c => {
                    const targetCell = dgrSheet[c + rowStr];
                    if (targetCell && (targetCell.v !== undefined || targetCell.f)) {
                        let out = `  -> Data at ${c}${rowStr}: Value=${targetCell.v}`;
                        if (targetCell.f) out += ` | Formula=${targetCell.f}`;
                        console.log(out);
                    }
                });
            }
        }
    }
}
