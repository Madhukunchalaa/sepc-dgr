// Sample Power Entry Excel for 06-Feb-2026
// Readings = Feb 5 actuals + one typical day's increment
// Feb 5 actuals from production DB used as base
const XLSX = require('../node_modules/xlsx');

const date = '2026-02-06';

// ── Feb 5 actuals (from production DB) ──────────────────────
// Feb 4→5 daily deltas used to estimate Feb 6 readings:
//   GEN_MAIN    : +11.536   UT_A_IMP : +0.630
//   GEN_CHECK   : +11.530   UT_A_CHK : +0.624
//   GT_EXP_MAIN : +3,895    UT_B_IMP : +0.583
//   GT_IMP_MAIN : 0         UT_B_CHK : +0.551
//   LINE1_EXP   : +976      BR_IMP   : +0.004
//   LINE2_EXP   : +3,897
// ────────────────────────────────────────────────────────────

const rows = [
  ['DGR Portal Data Entry Template', '', ''],
  [`Date: ${date}`, '', ''],
  ['', '', ''],
  ['Field', 'Unit', 'Value'],

  // ── Meter Readings (cumulative) ──────────────────────────
  //   Enter today's meter panel reading (must be > Feb 5 reading)
  ['GEN Meter - Main',    'MF×0.725455',  13086.400],   // Feb 5: 13074.778 + ~11.6
  ['GEN Meter - Check',   'MF×0.725455',  13082.200],   // Feb 5: 13070.716 + ~11.5
  ['GT Main Import',      'MF×3.636364',  24893.000],   // Feb 5: 24893.000 (no change)
  ['GT Main Export',      'MF×3.636364',  4488271.000], // Feb 5: 4484371   + 3900
  ['GT Check Import',     'MF×3.636364',  24622.000],   // Feb 5: 24622.000 (no change)
  ['GT Check Export',     'MF×3.636364',  10449.000],   // Feb 5: 10449.000 (no change)
  ['UT A Main Import',    'MF×0.400000',    291.900],   // Feb 5: 291.251   + 0.649
  ['UT A Check Import',   'MF×0.400000',    142.400],   // Feb 5: 141.792   + 0.608
  ['UT B Main Import',    'MF×0.400000',     64.600],   // Feb 5: 64.011    + 0.589
  ['UT B Check Import',   'MF×0.400000',    317.900],   // Feb 5: 317.316   + 0.584
  ['BR Main Import',      'MF×1.818182',      6.170],   // Feb 5: 6.166     + 0.004
  ['Line 1 Main Export',  'MF×3.636364',  1128553.000], // Feb 5: 1127573   + 980
  ['Line 2 Main Export',  'MF×3.636364',  4490446.000], // Feb 5: 4486546   + 3900

  // ── Grid Parameters & Operations ─────────────────────────
  ['Grid Freq Min',       'Hz',    49.900],
  ['Grid Freq Max',       'Hz',    50.200],
  ['Grid Freq Avg',       'Hz',    50.010],
  ['Hours on Grid',       'hrs',   24],
  ['Forced Outages',      'Nos',   0],
  ['Planned Outages',     'Nos',   0],
  ['RSD Count',           'Nos',   0],
  ['Partial Loading %',   '%',     0],
  ['Outage Remarks',      '',      'NIL'],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }];
XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');

const out = 'C:/Users/IE-Admin/Desktop/power_2026-02-06.xlsx';
XLSX.writeFile(wb, out);
console.log('Created:', out);
console.log('\nExpected after upload + save:');
console.log('  Generation  : ~8.43 MU  (delta GEN_MAIN 11.622 × MF 0.725455)');
console.log('  Export GT   : ~14.18 MU (delta GT_EXP_MAIN 3900 × MF 3.636364)');
console.log('  Import GT   : 0 MU      (no change in GT_IMP_MAIN)');
console.log('  Hours Grid  : 24');
