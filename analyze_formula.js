const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

function getValF(sheetName, cell) {
    const s = wb.Sheets[sheetName];
    if (!s || !s[cell]) return 'Not found';
    return s[cell].f ? `Formula: ${s[cell].f}` : `Value: ${s[cell].v}`;
}

// Power Generation MU (Power!BL8)
console.log('Power Generation MU (Power!BL8):', getValF('Power', 'BL8'));

// The Excel formulas we just extracted:
// SCC Daily = IFERROR(AC7/(Power!BL8*1000),0) = Coal Cons(kg) / Power Generation(MWh) ? Or kWh?
// Let's analyze: Power!BL8 is MU. MU * 1000 = MWh. Coal Cons in Fuel&Ash AC7 is in MT. MT * 1000 = kg.
// Actually, kg / kWh is mathematically the same as MT / MWh.
// Let's trace it carefully: SCC = MT/MWh => (CoalCons MT) / (PowerGen MU * 1000)

// GHR Formula: IFERROR(((F7*I7)+(N7*10700))/(1000*M7),)
// F7 = GCV_AF (kCal/kg)
// I7 = Coal Cons (MT)
// N7 = 'Fuel & Ash'!H7+'Fuel & Ash'!S7 = LDO Cons (KL) + HFO Cons (KL) = Oil Cons (KL)
// M7 = Power Generation (MU)
// GHR = (GCV_AF * Coal_MT + Oil_KL * 10700) / (Power_MU * 1000)
// This gives kCal/kWh.

console.log('--- Database Verification vs Excel ---');
const dbCode = `
// Current DB implementation in fuel.controller.js
const exportKwh = (pw[0]?.export_mu || 0) * 1000000;
const coalKg    = (coalConsMt || 0) * 1000;
const sccKgKwh  = exportKwh > 0 ? coalKg / exportKwh : null;
`;

console.log('DB Implementation:', dbCode);
console.log('Excel Formula:', 'SCC = CoalCons_MT / (PowerGen_MU * 1000)');

console.log('Finding: The database uses EXPORT_MU. The Excel uses Power!BL8, which is TOTAL GENERATION MU.');

