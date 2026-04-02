// Create a sample DGR FY Excel for testing the SEPC Excel Import feature
// Target test date: 2025-06-10
const XLSX = require('../node_modules/xlsx');

const TARGET = '2026-03-23';

const longDate = (d) => {
  const dt = new Date(d + 'T12:00:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dd}, ${dt.getFullYear()}`;
};

const shortDate = (d) => {
  const dt = new Date(d + 'T12:00:00');
  return `${dt.getMonth()+1}/${dt.getDate()}/${String(dt.getFullYear()).slice(-2)}`;
};

const wb = XLSX.utils.book_new();

// ────────────────────────────────────────────────
// 1. POWER SHEET
// Col 0=DATE, 1=GEN_MAIN(MF=0.72), 2=GEN_CHECK, 3=GT_IMP(MF=3.6), 4=GT_EXP(MF=3.6)
// Header rows 0-6 (7 rows), data starts row 7
// For 2025-06-10:
//   GEN_MAIN prev=10006.250 cur=10018.750 → delta=12.500 × 0.72 = 9.000 MU gen
//   GT_EXP   prev=2001.111 cur=2003.333  → delta=2.222  × 3.6  = 8.000 MU export
//   GT_IMP   prev=2000.500 cur=2001.000  → delta=0.500  × 3.6  = 1.800 MU import
// ────────────────────────────────────────────────
const powerData = [
  [1, 2, 3, 4, 5],
  [null, null, null, null, null],
  ['DATE', 'GEN MAIN METER (MF=0.72)', 'GEN CHECK METER', 'GT IMPORT MAIN (MF=3.6)', 'GT EXPORT MAIN (MF=3.6)'],
  ['UOM', null, null, null, null],
  ['MF', 0.72, null, 3.6, 3.6],
  ['Initial / Opening', 9990.000, 9985.000, 1998.000, 1997.000],
  [null, null, null, null, null],
  // data rows (idx 7, 8, 9)
  [longDate('2026-03-21'), 10000.000, 9996.000, 2000.000, 2000.000],
  [longDate('2026-03-22'), 10006.250, 10002.000, 2000.500, 2001.111],
  [longDate(TARGET),       10018.750, 10014.000, 2001.000, 2003.333],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(powerData), 'Power');

// ────────────────────────────────────────────────
// 2. FUEL & ASH SHEET
// 6 header rows (idx 0-5), data starts row 6
// Key cols (0-indexed):
//   1=LDO_RECEIPT, 7=LDO_CONS, 10=LDO_STOCK
//   12=HFO_RECEIPT, 18=HFO_CONS, 21=HFO_STOCK
//   25=COAL_RECEIPT, 28=COAL_CONS, 31=COAL_STOCK
//   35=H2_CONS, 38=H2_RECEIPT, 39=H2_STOCK
//   40=CO2_CONS, 43=CO2_RECEIPT, 44=CO2_STOCK
//   45=N2_CONS, 48=N2_RECEIPT, 49=N2_STOCK
//   53=FA_GENERATED, 56=BA_GENERATED
//   59=FA_TO_USER, 62=FA_TO_DYKE, 65=BA_TO_USER, 68=BA_TO_DYKE
// ────────────────────────────────────────────────
const fuelRow = (d, v) => {
  const r = Array(70).fill(null);
  r[0] = d;
  Object.entries(v).forEach(([k, val]) => { r[Number(k)] = val; });
  return r;
};

const fuelH0 = Array.from({ length: 70 }, (_, i) => i + 1);
const fuelH1 = Array(70).fill(null);
const fuelH2 = Array(70).fill(null);
fuelH2[0] = 'DATE'; fuelH2[1] = 'LDO'; fuelH2[7] = 'Daily Cons.'; fuelH2[10] = 'Stock';
fuelH2[12] = 'HFO'; fuelH2[18] = 'Daily Cons.'; fuelH2[21] = 'Stock';
fuelH2[25] = 'Coal'; fuelH2[26] = 'Daily Receipt'; fuelH2[28] = 'Daily Cons.'; fuelH2[31] = 'Stock';
fuelH2[35] = 'H2 Daily Cons.'; fuelH2[38] = 'Receipt'; fuelH2[39] = 'Stock';
fuelH2[40] = 'CO2 Daily Cons.'; fuelH2[43] = 'Receipt'; fuelH2[44] = 'Stock';
fuelH2[45] = 'N2 Daily Cons.'; fuelH2[48] = 'Receipt'; fuelH2[49] = 'Stock';
fuelH2[53] = 'FA Generated'; fuelH2[56] = 'BA Generated';
fuelH2[59] = 'FA to User'; fuelH2[62] = 'FA to Dyke'; fuelH2[65] = 'BA to User'; fuelH2[68] = 'BA to Dyke';
const fuelH3 = Array(70).fill(null);
const fuelH4 = Array(70).fill(null);
const fuelH5 = Array(70).fill(null);

const fuelData = [
  fuelH0, fuelH1, fuelH2, fuelH3, fuelH4, fuelH5,
  fuelRow(longDate('2026-03-21'), {
    1:0, 7:0.5, 10:180,  12:0, 18:0, 21:850,
    25:0,    28:3200, 31:68000,
    35:2, 38:0, 39:150, 40:0, 43:0, 44:55, 45:0, 48:0, 49:5,
    53:480, 56:75, 59:450, 62:30, 65:70, 68:5
  }),
  fuelRow(longDate('2026-03-22'), {
    1:0, 7:0.3, 10:179.7, 12:0, 18:0, 21:850,
    25:8500, 28:3350, 31:73150,
    35:2, 38:0, 39:148, 40:0, 43:0, 44:55, 45:0, 48:0, 49:5,
    53:490, 56:78, 59:460, 62:30, 65:72, 68:6
  }),
  fuelRow(longDate(TARGET), {
    1:0, 7:0.2, 10:179.5, 12:0, 18:0, 21:850,
    25:0, 28:3500, 31:69650,
    35:2, 38:0, 39:146, 40:0, 43:0, 44:55, 45:0, 48:0, 49:5,
    53:510, 56:80, 59:480, 62:30, 65:75, 68:5
  }),
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fuelData), 'Fuel & Ash');

// ────────────────────────────────────────────────
// 3. PERF SHEET
// 6 header rows, data starts row 6
// Col: 0=DATE, 1=GCV_AR, 5=GCV_AF, 8=COAL_CONS, 9=GHR, 12=GEN_MU
// ────────────────────────────────────────────────
const perfData = [
  Array.from({ length: 16 }, (_, i) => i + 1),
  Array(16).fill(null),
  ['DATE','GCV (AR-50)',null,null,'Coal Receipt','GCV (as fired)',null,null,'Coal Consumption','Gross Heat Rate (Direct) AFB',null,null,'Power Generation','Oil Consumption','Remarks for HR','Remarks for Oil Consumption'],
  [null,'Daily','MTD','YTD',null,'Daily','MTD','YTD',null,'Daily','MTD','YTD',null,null,null,null],
  ['UOM / MF','kcal/kg','kcal/kg','kcal/kg','MT','kcal/kg','kcal/kg','kcal/kg','MT','kCal/kWh','kCal/kWh','kCal/kWh','MU','KL',null,null],
  Array(16).fill(null),
  [longDate('2026-03-21'), 3850, null, null, 0,    4050, null, null, 3200, 2390, null, null, 8.640, 0, 'Normal operation', 'NIL'],
  [longDate('2026-03-22'), 3860, null, null, 8500, 4060, null, null, 3350, 2385, null, null, 9.125, 0, 'Normal operation', 'NIL'],
  [longDate(TARGET),       3870, null, null, 0,    4070, null, null, 3500, 2380, null, null, 9.000, 0, 'Normal operation', 'NIL'],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perfData), 'Perf');

// ────────────────────────────────────────────────
// 4. WATER SHEET
// 6 header rows, data starts row 6
// Col: 1=DM_GEN, 4=DM_TOTAL_CONS, 7=DM_STOCK, 8=DM_CYCLE_MKUP,
//      17=SW_GEN, 20=SW_CONS, 23=SW_STOCK, 24=CT_MAKEUP,
//      33=OUTFALL, 42=SEA_INTAKE, 45=SWI_FLOW, 56=POTABLE
// ────────────────────────────────────────────────
const wRow = (d, v) => {
  const r = Array(60).fill(null);
  r[0] = d;
  Object.entries(v).forEach(([k, val]) => { r[Number(k)] = val; });
  return r;
};
const waterHdr0 = Array.from({ length: 60 }, (_, i) => i + 1);
const waterHdr1 = Array(60).fill(null);
const waterHdr2 = Array(60).fill(null);
waterHdr2[0]='DATE'; waterHdr2[1]='DM Generation'; waterHdr2[4]='DM Total Cons.';
waterHdr2[7]='DM Stock'; waterHdr2[8]='DM Cycle Makeup';
waterHdr2[17]='Service Water Gen'; waterHdr2[20]='Service Water Cons';
waterHdr2[23]='SW Stock'; waterHdr2[24]='CT Makeup Sea Water';
waterHdr2[33]='Outfall'; waterHdr2[42]='Sea Water Intake'; waterHdr2[45]='SWI Flow'; waterHdr2[56]='Potable Water';

const waterData = [
  waterHdr0, waterHdr1, waterHdr2, Array(60).fill(null), Array(60).fill(null), Array(60).fill(null),
  wRow(longDate('2026-03-21'), {1:820, 4:470, 7:2200, 8:360, 17:680, 20:710, 23:8100, 24:98000, 33:82000, 42:102000, 45:4200, 56:52}),
  wRow(longDate('2026-03-22'), {1:810, 4:465, 7:2200, 8:355, 17:675, 20:705, 23:8100, 24:97500, 33:81500, 42:101500, 45:4180, 56:50}),
  wRow(longDate(TARGET),       {1:800, 4:460, 7:2200, 8:350, 17:670, 20:700, 23:8100, 24:97000, 33:81000, 42:101000, 45:4150, 56:48}),
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(waterData), 'Water');

// ────────────────────────────────────────────────
// 5. AVAILABILITY SHEET
// 4 header rows, data starts row 4
// Col: 0=DATE, 4=PAF_PCT, 10=RUNNING_HRS, 13=PLANNED_HRS, 16=PLANNED_PCT,
//      19=FORCED_HRS, 22=FORCED_PCT, 25=RSD_HRS, 28=RSD_PCT
// ────────────────────────────────────────────────
const avRow = (d, v) => {
  const r = Array(30).fill(null);
  r[0] = d;
  Object.entries(v).forEach(([k, val]) => { r[Number(k)] = val; });
  return r;
};
const avData = [
  Array.from({ length: 30 }, (_, i) => i + 1),
  Array(30).fill(null),
  ['DATE',null,null,null,'PAF %',null,null,null,null,null,'Running Hrs',null,null,'Planned Outage Hrs',null,null,'Planned %',null,null,'Forced Outage Hrs',null,null,'Forced %',null,null,'RSD Hrs',null,null,'RSD %'],
  Array(30).fill(null),
  avRow(longDate('2026-03-21'), {4:'100.00%', 10:'24:00', 13:'0:00', 16:'0.00%', 19:'0:00', 22:'0.00%', 25:'0:00', 28:'0.00%'}),
  avRow(longDate('2026-03-22'), {4:'100.00%', 10:'24:00', 13:'0:00', 16:'0.00%', 19:'0:00', 22:'0.00%', 25:'0:00', 28:'0.00%'}),
  avRow(longDate(TARGET),       {4:'98.50%',  10:'23:38', 13:'0:22', 16:'1.53%', 19:'0:00', 22:'0.00%', 25:'0:00', 28:'0.00%'}),
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(avData), 'Availability');

// ────────────────────────────────────────────────
// 6. DC-SG SHEET
// 3 header rows, data starts row 3
// Col: 0=DATE(M/D/YY), 1=DC_MU, 2=TOTAL_SG, 9=RTM, 16=DAM
// ────────────────────────────────────────────────
const dcRow = (d, v) => {
  const r = Array(20).fill(null);
  r[0] = shortDate(d);
  Object.entries(v).forEach(([k, val]) => { r[Number(k)] = val; });
  return r;
};
const dcData = [
  Array.from({ length: 20 }, (_, i) => i + 1),
  ['Year / Month Chart', ...Array(19).fill(null)],
  ['DATE','DC in Mu','Total SG in Mu Daily',null,null,null,null,null,null,'RTM Cleared Daily',null,null,null,null,null,null,'DAM Cleared Daily'],
  dcRow('2026-03-20', {1:11.81, 2:8.50, 9:0,    16:0   }),
  dcRow('2026-03-21', {1:11.81, 2:8.64, 9:0,    16:0   }),
  dcRow('2026-03-22', {1:11.81, 2:9.12, 9:0.50, 16:0   }),
  dcRow(TARGET,       {1:11.81, 2:9.00, 9:0.80, 16:0.20}),
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dcData), 'DC-SG');

// ────────────────────────────────────────────────
// 7. ACTIVITIES SHEET
// 2 header rows, data starts row 2
// Col: 0=DATE, 1=ACTIVITIES, 2=RUNNING_EQUIP, 3=OUTAGE
// ────────────────────────────────────────────────
const actData = [
  [1, 2, 3, 4],
  ['DATE', 'Activities / Boiler', 'Running Equipment', 'Outage Remarks'],
  [
    longDate('2026-03-21'),
    'Boiler\n1. Coal feeder-A PM work completed\n2. APH hopper cleaning done\n\nTurbine\n1. TDBFP-A PM completed',
    'BOILER: Mill A,C,D,E; BCP A&C; IDF A&B; FDF A&B\nTURBINE: TDBFP A,B; CEP A,C; CWP A,B',
    '1. ID FAN-A inlet gate gear box under observation'
  ],
  [
    longDate('2026-03-22'),
    'Boiler\n1. Coal Mill-C inspection done\n\nBOP\n1. HVAC condenser PM work done',
    'BOILER: Mill A,C,D,E; BCP A&C; IDF A&B; FDF A&B\nTURBINE: TDBFP A,B; CEP A,C; CWP A,B',
    '1. ID FAN-A inlet gate gear box under observation'
  ],
  [
    longDate(TARGET),
    'Boiler\n1. Coal Mill-B taken in service after PM\n2. Coal feeder-B hopper cleaned\n\nTurbine\n1. HP turbine inner casing temperature monitored',
    'BOILER: Mill A,B,C,D,E; BCP A&C; IDF A&B; FDF A&B\nTURBINE: TDBFP A,B; CEP A,C; CWP A,B',
    '1. ID FAN-A inlet gate gear box - monitoring continues\n2. IP Turbine inner casing temp showing high value'
  ],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(actData), 'Activities');

// ── Write ──
const outPath = 'C:/Users/IE-Admin/Desktop/DGR_Sample_2026-03-23.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Created:', outPath);
console.log('\nExpected for date 2025-06-10:');
console.log('  Power gen  : 9.000 MU');
console.log('  Export     : 8.000 MU');
console.log('  Import     : 1.800 MU');
console.log('  APC        : 2.800 MU');
console.log('  Coal cons  : 3500 MT');
console.log('  GCV_AF     : 4070 kcal/kg');
console.log('  PAF        : 98.50%');
console.log('  On-bar hrs : 23.633 hrs');
console.log('  DC         : 11.81 MU');
console.log('  SG PPA     : 8.00 MU');
console.log('  SG RTM     : 0.80 MU');
console.log('  SG DAM     : 0.20 MU');
console.log('  DM gen     : 800 m3');
console.log('  CT makeup  : 97000 m3');
