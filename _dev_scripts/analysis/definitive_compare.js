const xlsx = require('xlsx');

const file = 'TAQA MEIL Neyveli Daily Generation Report Master file 2025-26 R5.xlsx';
const wb = xlsx.readFile(file, { cellFormula: true });
const dgr = wb.Sheets['DGR'];

// Set date to Jan 2, 2026
const targetSerial = 46024;
dgr['E3'] = { v: targetSerial, t: 'n' };

// Force recalculation? basic xlsx-js won't.
// But we can look at the 24 cal column JU directly, which is what DGR does.
const cal = wb.Sheets['24 cal'];
const JU = 'JU';

console.log(`--- DEFINITIVE COMPARISON: JAN 2, 2026 ---`);
console.log(`(Serial: ${targetSerial})`);

const results = [];

// SN 1-9
const SN_MAP = {
    1: { label: "Rated Capacity", calRow: 68 }, // Wait, SN 1 in 24 cal? 
    2: { label: "Declared Capacity", calRow: 56 }, // Ops Input JU56
    4: { label: "Schedule Generation", calRow: 27 }, // 24 cal Row 27
    5: { label: "Gross Generation", calRow: 32 }, // 24 cal Row 32
    6: { label: "Deemed Generation", calRow: 37 }, // 24 cal Row 37
    7: { label: "Auxiliary Consumption", calRow: 33 }, // 24 cal Row 33
    8: { label: "Net Import", calRow: 30 }, // 24 cal Row 30
    9: { label: "Net Export", calRow: 24 } // 24 cal Row 24
};

// Also calculate Portal values using my logic
const MF_GEN = (18 * 12000 / 110);
const MF_EXP = (230 / 110 * 500);

const jan2_gen_m = 4724.901767;
const jan1_gen_m = 4722.120207;
const portalGenMu = ((jan2_gen_m - jan1_gen_m) * MF_GEN) / 1000;

const d = (c, p) => (c || 0) - (p || 0);
// For export, the DB shows nulls for detailed meters, and net_export=5041.88
// In my new engine, if detailed meters are missing, it might show 0 unless I add a fallback.
// Wait! Let me check if my engine has a fallback for net_export if detailed meters are missing.
// I'll check taqa.engine.js content again.

Object.keys(SN_MAP).forEach(sn => {
    const item = SN_MAP[sn];
    const excelVal = cal[JU + item.calRow] ? cal[JU + item.calRow].v : 0;

    // Convert MWh to MU if needed
    let excelMU = excelVal;
    if ([2, 4, 5, 6, 7, 8, 9].includes(parseInt(sn))) {
        excelMU = excelVal / 1000;
    }

    results.push({
        sn,
        particulars: item.label,
        excel: excelMU.toFixed(4),
        portal: (sn == 5) ? portalGenMu.toFixed(4) : "TBD"
    });
});

console.table(results);

// Detailed check for Export fallback
console.log("\nPORTAL ENGINE LOGIC CHECK:");
console.log(`Gross Gen MU: ${portalGenMu.toFixed(4)}`);
console.log(`Excel Gen MU: ${(cal[JU + '32'].v / 1000).toFixed(4)}`);
console.log(`MATCH: ${portalGenMu.toFixed(4) === (cal[JU + '32'].v / 1000).toFixed(4)}`);
