const path = require('path');
let helpers;
try {
    helpers = require(path.join(__dirname, 'helpers.js'));
} catch (e) {
    helpers = require('./helpers');
}
const { getFYStartDate, getSubmissionStatus, processNumbers, query } = helpers;

async function assembleAnparaDGR(plant, targetDate) {
    console.log(`[anpara.engine] Assembling DGR for ${plant?.short_name} on ${targetDate}`);
    const plantId = plant.id;
    const date = new Date(targetDate);
    const fyStartDate = await getFYStartDate(plantId, targetDate);

    const fyDate = new Date(fyStartDate);
    const fyYear = fyDate.getFullYear();
    const fyLabel = `${fyYear}-${fyYear + 1}`;

    const [allRes, submissionStatus] = await Promise.all([
        query(
            `SELECT * FROM anpara_daily_input
             WHERE plant_id=$1 AND entry_date >= $2 AND entry_date <= $3
             ORDER BY entry_date ASC`,
            [plantId, fyStartDate, targetDate]
        ),
        getSubmissionStatus(plantId, targetDate)
    ]);

    const safeDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string') return d.split('T')[0];
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const lastRow = allRes.rows[allRes.rows.length - 1];
    if (!allRes.rows.length || safeDate(lastRow?.entry_date) !== targetDate) {
        const err = new Error('No Anpara data for this date. Enter Ops Input first.');
        err.code = 'ANPARA_NO_DATA';
        throw err;
    }

    // Constants
    const UNIT_CAPACITY_MW = 600;
    const DP_MU = (UNIT_CAPACITY_MW * 24) / 1000;  // 14.4 MU per unit per day

    const N = (val) => Number(val || 0);
    const sum  = (rows, field) => rows.reduce((acc, row) => acc + N(row[field]), 0);
    const sumF = (rows, fn)    => rows.reduce((acc, row) => acc + (fn(row) || 0), 0);
    const pct  = (num, den)    => (den > 0 ? (num / den) * 100 : 0);

    // ── Split rows ────────────────────────────────────────────────────────────
    const r       = allRes.rows[allRes.rows.length - 1];  // target day
    const ytdRows = allRes.rows;
    const mtdRows = allRes.rows.filter(d => safeDate(d.entry_date).slice(0, 7) === targetDate.slice(0, 7));

    // ── Per-row computed helpers ───────────────────────────────────────────────
    const stationGen   = (d) => N(d.u1_gen_mu) + N(d.u2_gen_mu);
    const stationCoal  = (d) => N(d.u1_coal_mt) + N(d.u2_coal_mt);
    const stationApc   = (d) => N(d.u1_apc_mu) + N(d.u2_apc_mu);
    const stationOil   = (d) => N(d.u1_oil_ldo_kl) + N(d.u2_oil_ldo_kl);
    const stationDm    = (d) => N(d.u1_dm_water_m3) + N(d.u2_dm_water_m3);
    const stationH2    = (d) => N(d.u1_h2_cylinders) + N(d.u2_h2_cylinders);
    const totalDC      = (d) => N(d.dc_uppcl_mu) + N(d.dc_third_party_mu);

    // PLF = Gen / (Capacity × 24/1000) × 100
    const plf_u1 = (d) => pct(N(d.u1_gen_mu), DP_MU);
    const plf_u2 = (d) => pct(N(d.u2_gen_mu), DP_MU);
    const plf_st = (d) => pct(stationGen(d), DP_MU * 2);

    // Average Load (MW) = Gen_MU × 1000 / run_hours
    const avgLoad_u1 = (d) => N(d.u1_run_hours) > 0 ? (N(d.u1_gen_mu) * 1000) / N(d.u1_run_hours) : 0;
    const avgLoad_u2 = (d) => N(d.u2_run_hours) > 0 ? (N(d.u2_gen_mu) * 1000) / N(d.u2_run_hours) : 0;
    const avgLoad_st = (d) => avgLoad_u1(d) + avgLoad_u2(d);

    // Loading Factor % = Avg Load / Capacity × 100
    const loadFactor_u1 = (d) => pct(avgLoad_u1(d), UNIT_CAPACITY_MW);
    const loadFactor_u2 = (d) => pct(avgLoad_u2(d), UNIT_CAPACITY_MW);
    const loadFactor_st = (d) => pct(avgLoad_st(d), UNIT_CAPACITY_MW * 2);

    // APC %
    const apcPct_u1 = (d) => pct(N(d.u1_apc_mu), N(d.u1_gen_mu));
    const apcPct_u2 = (d) => pct(N(d.u2_apc_mu), N(d.u2_gen_mu));
    const apcPct_st = (d) => pct(stationApc(d), stationGen(d));

    // Specific Coal Consumption (kg/kWh) = coal_MT × 1000 / (gen_MU × 1e6) × 1000 = coal / gen / 1000 × 1e3
    // = coal_MT / (gen_MU × 1000)
    const scc_u1 = (d) => N(d.u1_gen_mu) > 0 ? N(d.u1_coal_mt) / (N(d.u1_gen_mu) * 1000) : 0;
    const scc_u2 = (d) => N(d.u2_gen_mu) > 0 ? N(d.u2_coal_mt) / (N(d.u2_gen_mu) * 1000) : 0;
    const scc_st = (d) => stationGen(d) > 0   ? stationCoal(d) / (stationGen(d) * 1000)  : 0;

    // Specific Oil (mL/kWh) = oil_KL × 1e6 mL / (gen_MU × 1e6 kWh) = oil_KL / gen_MU
    const spOil_u1 = (d) => N(d.u1_gen_mu) > 0 ? N(d.u1_oil_ldo_kl) / N(d.u1_gen_mu) : 0;
    const spOil_u2 = (d) => N(d.u2_gen_mu) > 0 ? N(d.u2_oil_ldo_kl) / N(d.u2_gen_mu) : 0;
    const spOil_st = (d) => stationGen(d) > 0   ? stationOil(d) / stationGen(d)         : 0;

    // DM Water % = dm_m3 / (gen_MU × 1e6 kWh) × 100 × ...
    // From Excel: Hot well make-up % = dm_m3 / (gen_MU × 1000 MWh) × 100 = dm_m3 / (gen_MU × 1000) × 100
    const dmPct_u1 = (d) => N(d.u1_gen_mu) > 0 ? (N(d.u1_dm_water_m3) / (N(d.u1_gen_mu) * 1000)) * 100 : 0;
    const dmPct_u2 = (d) => N(d.u2_gen_mu) > 0 ? (N(d.u2_dm_water_m3) / (N(d.u2_gen_mu) * 1000)) * 100 : 0;
    const dmPct_st = (d) => stationGen(d) > 0   ? (stationDm(d) / (stationGen(d) * 1000)) * 100 : 0;

    // Total DC Loss per unit (MU)
    const totalLoss_u1 = (d) => N(d.u1_btl_loss_mu) + N(d.u1_equip_loss_mu) + N(d.u1_planned_loss_mu)
                               + N(d.u1_trip_loss_mu) + N(d.u1_coal_constraint_mu) + N(d.u1_grid_backing_mu);
    const totalLoss_u2 = (d) => N(d.u2_btl_loss_mu) + N(d.u2_equip_loss_mu) + N(d.u2_planned_loss_mu)
                               + N(d.u2_trip_loss_mu) + N(d.u2_coal_constraint_mu) + N(d.u2_grid_backing_mu);
    const totalLoss_st = (d) => totalLoss_u1(d) + totalLoss_u2(d);

    // DC Loss % = loss_MU / (2 × DP_MU) × 100 (station denominator = 2 units)
    const lossPct = (lossMU, nUnits) => pct(lossMU, DP_MU * nUnits);

    // ── Section A: Performance Parameters ────────────────────────────────────
    const makeRow = (label, uom, fn_u1, fn_u2, fn_st) => ({
        particulars: label, uom,
        daily_u1:  fn_u1(r),
        daily_u2:  fn_u2(r),
        daily_st:  fn_st(r),
        mtd_u1:    sumF(mtdRows, fn_u1),
        mtd_u2:    sumF(mtdRows, fn_u2),
        mtd_st:    sumF(mtdRows, fn_st),
        ytd_u1:    sumF(ytdRows, fn_u1),
        ytd_u2:    sumF(ytdRows, fn_u2),
        ytd_st:    sumF(ytdRows, fn_st),
    });
    const makeAvgRow = (label, uom, fn_u1, fn_u2, fn_st) => ({
        particulars: label, uom,
        daily_u1: fn_u1(r),
        daily_u2: fn_u2(r),
        daily_st: fn_st(r),
        mtd_u1: mtdRows.length ? sumF(mtdRows, fn_u1) / mtdRows.length : 0,
        mtd_u2: mtdRows.length ? sumF(mtdRows, fn_u2) / mtdRows.length : 0,
        mtd_st: mtdRows.length ? sumF(mtdRows, fn_st) / mtdRows.length : 0,
        ytd_u1: ytdRows.length ? sumF(ytdRows, fn_u1) / ytdRows.length : 0,
        ytd_u2: ytdRows.length ? sumF(ytdRows, fn_u2) / ytdRows.length : 0,
        ytd_st: ytdRows.length ? sumF(ytdRows, fn_st) / ytdRows.length : 0,
    });

    const perfRows = [
        makeRow   ('Generation',         'MU',      d => N(d.u1_gen_mu), d => N(d.u2_gen_mu), stationGen),
        makeAvgRow('PLF',                '%',       plf_u1,   plf_u2,   plf_st),
        makeAvgRow('Average Load',       'MW',      avgLoad_u1, avgLoad_u2, avgLoad_st),
        makeAvgRow('Loading Factor',     '%',       loadFactor_u1, loadFactor_u2, loadFactor_st),
        makeAvgRow('APC',                '%',       apcPct_u1, apcPct_u2, apcPct_st),
        makeRow   ('SG',                 'MU',      () => N(r.sg_mu), () => 0, d => N(d.sg_mu)),
        makeRow   ('AG (Net Export)',     'MU',      () => N(r.net_export_mu), () => 0, d => N(d.net_export_mu)),
        {
            particulars: 'SG/DC', uom: '%',
            daily_u1: null, daily_u2: null,
            daily_st: pct(N(r.sg_mu), totalDC(r)),
            mtd_u1: null, mtd_u2: null,
            mtd_st: pct(sum(mtdRows, 'sg_mu'), sumF(mtdRows, totalDC)),
            ytd_u1: null, ytd_u2: null,
            ytd_st: pct(sum(ytdRows, 'sg_mu'), sumF(ytdRows, totalDC)),
        },
        {
            particulars: 'AG/SG', uom: '%',
            daily_u1: null, daily_u2: null,
            daily_st: pct(N(r.net_export_mu), N(r.sg_mu)),
            mtd_u1: null, mtd_u2: null,
            mtd_st: pct(sum(mtdRows, 'net_export_mu'), sum(mtdRows, 'sg_mu')),
            ytd_u1: null, ytd_u2: null,
            ytd_st: pct(sum(ytdRows, 'net_export_mu'), sum(ytdRows, 'sg_mu')),
        },
        {
            particulars: 'DSM',  uom: '₹',
            daily_u1: null, daily_u2: null, daily_st: N(r.dsm_rs),
            mtd_u1: null, mtd_u2: null, mtd_st: sum(mtdRows, 'dsm_rs'),
            ytd_u1: null, ytd_u2: null, ytd_st: sum(ytdRows, 'dsm_rs'),
        },
        {
            particulars: 'Net Saving', uom: '₹',
            daily_u1: null, daily_u2: null, daily_st: N(r.net_saving_rs),
            mtd_u1: null, mtd_u2: null, mtd_st: sum(mtdRows, 'net_saving_rs'),
            ytd_u1: null, ytd_u2: null, ytd_st: sum(ytdRows, 'net_saving_rs'),
        },
    ];

    // ── Section B: DC Loss ────────────────────────────────────────────────────
    const lossRow = (label, fn_u1, fn_u2) => ({
        particulars: label, uom: 'MU',
        daily_u1: fn_u1(r), daily_u2: fn_u2(r), daily_st: fn_u1(r) + fn_u2(r),
        mtd_u1: sumF(mtdRows, fn_u1), mtd_u2: sumF(mtdRows, fn_u2), mtd_st: sumF(mtdRows, fn_u1) + sumF(mtdRows, fn_u2),
        ytd_u1: sumF(ytdRows, fn_u1), ytd_u2: sumF(ytdRows, fn_u2), ytd_st: sumF(ytdRows, fn_u1) + sumF(ytdRows, fn_u2),
    });

    const dcLossRows = [
        lossRow('BTL DC Loss',              d => N(d.u1_btl_loss_mu),        d => N(d.u2_btl_loss_mu)),
        lossRow('Equipment Problem DC Loss', d => N(d.u1_equip_loss_mu),      d => N(d.u2_equip_loss_mu)),
        lossRow('Planned Outage DC Loss',   d => N(d.u1_planned_loss_mu),    d => N(d.u2_planned_loss_mu)),
        lossRow('Unit Trip DC Loss',        d => N(d.u1_trip_loss_mu),       d => N(d.u2_trip_loss_mu)),
        lossRow('Coal Constraint DC Loss',  d => N(d.u1_coal_constraint_mu), d => N(d.u2_coal_constraint_mu)),
        lossRow('Grid Backing Down',        d => N(d.u1_grid_backing_mu),    d => N(d.u2_grid_backing_mu)),
        {
            particulars: 'Total DC Loss', uom: 'MU',
            daily_u1: totalLoss_u1(r), daily_u2: totalLoss_u2(r), daily_st: totalLoss_st(r),
            mtd_u1: sumF(mtdRows, totalLoss_u1), mtd_u2: sumF(mtdRows, totalLoss_u2), mtd_st: sumF(mtdRows, totalLoss_st),
            ytd_u1: sumF(ytdRows, totalLoss_u1), ytd_u2: sumF(ytdRows, totalLoss_u2), ytd_st: sumF(ytdRows, totalLoss_st),
        },
        {
            particulars: 'Total DC Loss', uom: '%',
            daily_u1: lossPct(totalLoss_u1(r), 1), daily_u2: lossPct(totalLoss_u2(r), 1), daily_st: lossPct(totalLoss_st(r), 2),
            mtd_u1: lossPct(sumF(mtdRows, totalLoss_u1), mtdRows.length),
            mtd_u2: lossPct(sumF(mtdRows, totalLoss_u2), mtdRows.length),
            mtd_st: lossPct(sumF(mtdRows, totalLoss_st), mtdRows.length * 2),
            ytd_u1: lossPct(sumF(ytdRows, totalLoss_u1), ytdRows.length),
            ytd_u2: lossPct(sumF(ytdRows, totalLoss_u2), ytdRows.length),
            ytd_st: lossPct(sumF(ytdRows, totalLoss_st), ytdRows.length * 2),
        },
    ];

    // ── Section C: APC & Oil ──────────────────────────────────────────────────
    const apcOilRows = [
        makeAvgRow('APC',                    '%',       apcPct_u1,  apcPct_u2,  apcPct_st),
        makeRow   ('LDO Consumption',        'KL',      d => N(d.u1_oil_ldo_kl), d => N(d.u2_oil_ldo_kl), stationOil),
        makeAvgRow('Specific Oil Consumption','mL/kWh', spOil_u1,   spOil_u2,   spOil_st),
    ];

    // ── Section D: Coal ───────────────────────────────────────────────────────
    const coalRows = [
        makeRow   ('Coal Consumption',           'MT',     d => N(d.u1_coal_mt), d => N(d.u2_coal_mt), stationCoal),
        makeAvgRow('Specific Coal Consumption',  'kg/kWh', scc_u1, scc_u2, scc_st),
        {
            particulars: 'Coal Received', uom: 'MT',
            daily_u1: null, daily_u2: null, daily_st: N(r.coal_received_mt),
            mtd_u1: null, mtd_u2: null, mtd_st: sum(mtdRows, 'coal_received_mt'),
            ytd_u1: null, ytd_u2: null, ytd_st: sum(ytdRows, 'coal_received_mt'),
        },
        {
            particulars: 'Coal Stock (Usable)', uom: 'MT',
            daily_u1: null, daily_u2: null, daily_st: N(r.coal_stock_mt),
            mtd_u1: null, mtd_u2: null, mtd_st: null,
            ytd_u1: null, ytd_u2: null, ytd_st: null,
        },
    ];

    // ── Section E: Water ──────────────────────────────────────────────────────
    const waterRows = [
        makeRow   ('DM Water Consumption',   'M³',  d => N(d.u1_dm_water_m3), d => N(d.u2_dm_water_m3), stationDm),
        makeAvgRow('DM Water Consumption',   '%',   dmPct_u1, dmPct_u2, dmPct_st),
        {
            particulars: 'Raw Water Consumption', uom: 'M³',
            daily_u1: null, daily_u2: null, daily_st: N(r.raw_water_m3),
            mtd_u1: null, mtd_u2: null, mtd_st: sum(mtdRows, 'raw_water_m3'),
            ytd_u1: null, ytd_u2: null, ytd_st: sum(ytdRows, 'raw_water_m3'),
        },
        makeRow('H2 Cylinders', 'Nos/day', d => N(d.u1_h2_cylinders), d => N(d.u2_h2_cylinders), stationH2),
    ];

    // ── Section F: Outages ────────────────────────────────────────────────────
    // Approximate: outage happened if loss > 0
    const hadForced_u1  = (d) => (N(d.u1_btl_loss_mu) + N(d.u1_equip_loss_mu) + N(d.u1_trip_loss_mu)) > 0 ? 1 : 0;
    const hadForced_u2  = (d) => (N(d.u2_btl_loss_mu) + N(d.u2_equip_loss_mu) + N(d.u2_trip_loss_mu)) > 0 ? 1 : 0;
    const hadPlanned_u1 = (d) => N(d.u1_planned_loss_mu) > 0 ? 1 : 0;
    const hadPlanned_u2 = (d) => N(d.u2_planned_loss_mu) > 0 ? 1 : 0;

    const outageRows = [
        {
            particulars: 'No. of Forced Outages', uom: 'Nos',
            daily_u1: hadForced_u1(r),  daily_u2: hadForced_u2(r),  daily_st: hadForced_u1(r) + hadForced_u2(r),
            mtd_u1: sumF(mtdRows, hadForced_u1),  mtd_u2: sumF(mtdRows, hadForced_u2),  mtd_st: sumF(mtdRows, hadForced_u1) + sumF(mtdRows, hadForced_u2),
            ytd_u1: sumF(ytdRows, hadForced_u1),  ytd_u2: sumF(ytdRows, hadForced_u2),  ytd_st: sumF(ytdRows, hadForced_u1) + sumF(ytdRows, hadForced_u2),
        },
        {
            particulars: 'No. of Planned Outages', uom: 'Nos',
            daily_u1: hadPlanned_u1(r), daily_u2: hadPlanned_u2(r), daily_st: hadPlanned_u1(r) + hadPlanned_u2(r),
            mtd_u1: sumF(mtdRows, hadPlanned_u1), mtd_u2: sumF(mtdRows, hadPlanned_u2), mtd_st: sumF(mtdRows, hadPlanned_u1) + sumF(mtdRows, hadPlanned_u2),
            ytd_u1: sumF(ytdRows, hadPlanned_u1), ytd_u2: sumF(ytdRows, hadPlanned_u2), ytd_st: sumF(ytdRows, hadPlanned_u1) + sumF(ytdRows, hadPlanned_u2),
        },
    ];

    // ── Build Report ──────────────────────────────────────────────────────────
    const report = {
        header: {
            title: `DAILY GENERATION REPORT — ${fyLabel}`,
            company: plant?.company_name || 'MEIL Anpara Energy Limited',
            plantName: `${plant?.name || 'MEIL Anpara Energy Limited'} (2 × 600 MW)`,
            documentNumber: 'MAEL/P&E/F/28',
            date: targetDate,
            dayName:   date.toLocaleDateString('en-IN', { weekday: 'long' }),
            monthYear: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            fyLabel,
            units: ['Unit#1', 'Unit#2', 'Station'],
        },
        sections: [
            { title: 'A. PERFORMANCE PARAMETERS', rows: perfRows },
            { title: 'B. DC LOSS',                rows: dcLossRows },
            { title: 'C. APC & OIL',              rows: apcOilRows },
            { title: 'D. COAL',                   rows: coalRows },
            { title: 'E. WATER',                  rows: waterRows },
            { title: 'F. OUTAGES',                rows: outageRows },
        ],
        meta: {
            submissionStatus,
            generatedAt: new Date().toISOString(),
            plantId,
            targetDate,
        },
    };

    report.sections = processNumbers(report.sections);
    return report;
}

module.exports = { assembleAnparaDGR };
