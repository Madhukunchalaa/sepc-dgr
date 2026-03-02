const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'DGR FY 2025-20261 - V1 (1).xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true });

const dgrSheet = wb.Sheets['DGR'];

// DGR Row 17 (Coal Consumption LMT) => expected cell is AB17
const coalConsCell = dgrSheet['AB17'];
console.log('DGR Coal Consumption Cell (AB17):', coalConsCell ? (coalConsCell.f ? `Formula: ${coalConsCell.f}` : coalConsCell.v) : 'Not found');

// DGR Row 28 (Specific Coal Consumption kg/kwh) => expected cell is O28
const sccCell = dgrSheet['O28'];
console.log('DGR SCC Cell (O28):', sccCell ? (sccCell.f ? `Formula: ${sccCell.f}` : sccCell.v) : 'Not found');

// DGR Row 26 (GHR As Fired) => expected cell is P26
const ghrCell = dgrSheet['P26'];
console.log('DGR GHR Cell (P26):', ghrCell ? (ghrCell.f ? `Formula: ${ghrCell.f}` : ghrCell.v) : 'Not found');

// DGR Row 23 (Specific Oil Consumption ml/kwh) => expected cell is N23
const socCell = dgrSheet['N23'];
console.log('DGR SOC Cell (N23):', socCell ? (socCell.f ? `Formula: ${socCell.f}` : socCell.v) : 'Not found');
