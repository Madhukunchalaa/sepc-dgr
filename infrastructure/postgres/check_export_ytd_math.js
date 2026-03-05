const XLSX = require('xlsx');
const wb = XLSX.readFile('DGR FY 2025-20261 - V1 (1).xlsx');
const ws = wb.Sheets['Power'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

let exYtd = 0;
// April 1st to June 12th 2025
// April 1 is around row 2
let startRow = 1;
// June 12 is around row 73
for (let r = 5; r < data.length; r++) {
    const d = data[r][0];
    if (typeof d === 'number') {
        const dt = XLSX.SSF.parse_date_code(d);
        const y = dt.y, m = dt.m, day = dt.d;
        if (y === 2025 && (m > 4 || (m === 4 && day >= 1)) && (m < 6 || (m === 6 && day <= 12))) {
            const exp = data[r][82] || 0; // Export mu
            const imp = data[r][79] || 0; // Import mu
            exYtd += (exp - imp);
        }
    }
}
console.log('Script Computed YTD:', exYtd);
