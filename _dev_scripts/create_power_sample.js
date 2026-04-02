// Create sample Power Entry Excel matching the downloadTemplate format exactly
const XLSX = require('../node_modules/xlsx');

const date = '2026-03-23';

// Must match m.meter_name from DB exactly (as shown in the UI)
// And POWER_EXTRA_FIELDS labels from moduleExcel.js
const rows = [
  ['DGR Portal Data Entry Template', '', ''],
  [`Date: ${date}`, '', ''],
  ['', '', ''],
  ['Field', 'Unit', 'Value'],  // header row — parser looks for this

  // ── Meter Readings (cumulative) ──
  // For ~9 MU generation today (MF=0.72, delta=12.5):
  //   GEN_MAIN prev≈3488.000, cur=3500.500 → delta=12.5 × 0.72 = 9.000 MU gen
  // For ~8 MU export (MF=3.6, delta=2.222):
  //   GT_EXP prev≈3197.778, cur=3200.000 → delta=2.222 × 3.6 = 8.000 MU
  ['GEN Meter - Main',    'MF×0.720000',  3500.500],
  ['GEN Meter - Check',   'MF×0.720000',  3495.200],
  ['GT Main Import',      'MF×3.600000',   150.500],
  ['GT Main Export',      'MF×3.600000',  3200.000],
  ['GT Check Import',     'MF×3.600000',   149.000],
  ['GT Check Export',     'MF×3.600000',  3198.500],
  ['UT A Main Import',    'MF×0.400000',    52.400],
  ['UT A Check Import',   'MF×0.400000',    51.800],
  ['UT B Main Import',    'MF×0.400000',    54.200],
  ['UT B Check Import',   'MF×0.400000',    53.600],
  ['BR Main Import',      'MF×1.800000',    31.500],
  ['Line 1 Main Export',  'MF×3.600000',  1601.200],
  ['Line 2 Main Export',  'MF×3.600000',  1598.800],

  // ── Grid Parameters & Operations ──
  ['Grid Freq Min',       'Hz',    49.850],
  ['Grid Freq Max',       'Hz',    50.250],
  ['Grid Freq Avg',       'Hz',    50.012],
  ['Hours on Grid',       'hrs',   24],
  ['Forced Outages',      'Nos',   0],
  ['Planned Outages',     'Nos',   0],
  ['RSD Count',           'Nos',   0],
  ['Partial Loading %',   '%',     0],
  ['Outage Remarks',      '',      'NIL'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');

const out = 'C:/Users/IE-Admin/Desktop/power_2026-03-23.xlsx';
XLSX.writeFile(wb, out);
console.log('Created:', out);
console.log('\nExpected after upload + save:');
console.log('  GEN_MAIN reading : 3500.500');
console.log('  Freq Avg         : 50.012 Hz');
console.log('  Hours on Grid    : 24');
console.log('  (delta vs prev day readings will compute gen MU)');
