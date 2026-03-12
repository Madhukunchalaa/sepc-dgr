const xlsx = require('xlsx');

// 1. Multipliers from taqa.engine.js
const MF_GEN = (18 * 12000 / 110);      // ~1963.636
const MF_EXP = (230 / 110 * 500);       // ~1045.454

// 2. Data from Jan 1 & Jan 2 (from DB)
const jan1 = {
    gen_main_meter: 4722.120,
    peram_exp: 0, deviak_exp: 0, cuddal_exp: 0, nlc2_exp: 0,
    peram_imp: 0, deviak_imp: 0, cuddal_imp: 0, nlc2_imp: 0
};
const jan2 = {
    gen_main_meter: 4724.902,
    peram_exp: 0, deviak_exp: 0, cuddal_exp: 0, nlc2_exp: 0,
    peram_imp: 0, deviak_imp: 0, cuddal_imp: 0, nlc2_imp: 0,
    net_export: 5041.880, // fallback?
    net_import_sy: 0
};

// 3. Calculation Logic
const delta = (c, p) => Math.max(0, (c || 0) - (p || 0));

const dailyGenMu = (delta(jan2.gen_main_meter, jan1.gen_main_meter) * MF_GEN) / 1000;

// Export Logic: In my engine I used detailed meters. If detailed are 0, dExpMu is 0.
// BUT in Excel SN 9 usually links to Row 24.
// Let's see what Excel says for SN 9 on Jan 2nd.

console.log(`--- CALCULATED FOR PORTAL ---`);
console.log(`Gross Gen (Calc): ${dailyGenMu.toFixed(4)} MU`);

// Let's re-extract Excel SN 9 for Jan 2nd precisely.
const wb = xlsx.readFile('TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx', { cellFormula: true });
const dgr = wb.Sheets['DGR'];
const cal = wb.Sheets['24 cal'];

// Find JU column (Jan 2nd)
const targetCol = 'JU';
const excelGen = cal[targetCol + '32'] ? cal[targetCol + '32'].v : 'N/A';
const excelExp = cal[targetCol + '24'] ? cal[targetCol + '24'].v : 'N/A';

console.log(`\n--- EXCEL VALUES (Col JU / Row 32 & 24) ---`);
console.log(`Gross Gen (Excel): ${excelGen}`);
console.log(`Net Export (Excel): ${excelExp}`);

// Check SN 9 in DGR sheet
console.log(`\n--- DGR SHEET VALUES (SN 9) ---`);
console.log(`Net Export Daily: ${dgr['E12'] ? dgr['E12'].v : 'N/A'}`);
console.log(`Gross Gen Daily: ${dgr['E8'] ? dgr['E8'].v : 'N/A'}`);
