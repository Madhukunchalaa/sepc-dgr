// Anpara DGR Engine — formulas match Excel "DGR" sheet exactly
// 2 × 600 MW units; DP_MU = 14.4 MU per unit per day
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

    // ── Constants ────────────────────────────────────────────────────────────
    const UNIT_CAP_MW = 600;
    const DP_MU = (UNIT_CAP_MW * 24) / 1000;  // 14.4 MU per unit per day

    const N  = (v) => Number(v || 0);
    const sum  = (rows, field) => rows.reduce((acc, d) => acc + N(d[field]), 0);
    const sumF = (rows, fn)    => rows.reduce((acc, d) => acc + (fn(d) || 0), 0);
    const pct  = (num, den)    => (den > 0 ? (num / den) * 100 : 0);
    const avg  = (rows, fn)    => rows.length ? sumF(rows, fn) / rows.length : 0;

    // ── Row slices ────────────────────────────────────────────────────────────
    const r       = allRes.rows[allRes.rows.length - 1];  // target day
    const ytdRows = allRes.rows;
    const mtdRows = allRes.rows.filter(d => safeDate(d.entry_date).slice(0, 7) === targetDate.slice(0, 7));

    // ── Per-row helper functions (matching Excel DGR formulas) ─────────────
    const stationGen  = (d) => N(d.u1_gen_mu) + N(d.u2_gen_mu);
    const stationCoal = (d) => N(d.u1_coal_mt) + N(d.u2_coal_mt);
    const stationApc  = (d) => N(d.u1_apc_mu) + N(d.u2_apc_mu);
    const stationOil  = (d) => N(d.u1_oil_ldo_kl) + N(d.u2_oil_ldo_kl);
    const stationDm   = (d) => N(d.u1_dm_water_m3) + N(d.u2_dm_water_m3);
    const stationH2   = (d) => N(d.u1_h2_cylinders) + N(d.u2_h2_cylinders);
    const totalDC     = (d) => N(d.dc_uppcl_mu) + N(d.dc_third_party_mu);

    // PLF = gen_MU / DP_MU × 100  (Excel: gen / 14.4 * 100)
    const plf_u1 = (d) => pct(N(d.u1_gen_mu), DP_MU);
    const plf_u2 = (d) => pct(N(d.u2_gen_mu), DP_MU);
    const plf_st = (d) => pct(stationGen(d), DP_MU * 2);

    // Average Load (MW) = gen_MU × 1000 / 24  (Excel: gen * 1000 / 24)
    const avgLoad_u1 = (d) => N(d.u1_gen_mu) * 1000 / 24;
    const avgLoad_u2 = (d) => N(d.u2_gen_mu) * 1000 / 24;
    const avgLoad_st = (d) => stationGen(d) * 1000 / 24;

    // Loading Factor % = PLF / (run_hours/24×100) × 100
    // = (gen/14.4*100) / (run_hours/24*100) * 100
    // = gen / 14.4 / (run_hours / 24) * 100
    const lf_u1 = (d) => {
        const avail = N(d.u1_run_hours) / 24;
        return avail > 0 ? pct(N(d.u1_gen_mu), DP_MU * avail) : 0;
    };
    const lf_u2 = (d) => {
        const avail = N(d.u2_run_hours) / 24;
        return avail > 0 ? pct(N(d.u2_gen_mu), DP_MU * avail) : 0;
    };
    const lf_st = (d) => {
        const avail1 = N(d.u1_run_hours) / 24;
        const avail2 = N(d.u2_run_hours) / 24;
        const totalAvail = avail1 + avail2;
        return totalAvail > 0 ? pct(stationGen(d), DP_MU * totalAvail) : 0;
    };

    // APC % = apc_MU / gen_MU × 100
    const apcPct_u1 = (d) => pct(N(d.u1_apc_mu), N(d.u1_gen_mu));
    const apcPct_u2 = (d) => pct(N(d.u2_apc_mu), N(d.u2_gen_mu));
    const apcPct_st = (d) => pct(stationApc(d), stationGen(d));

    // SCC (kg/kWh) = coal_MT / (gen_MU × 1000)
    const scc_u1 = (d) => N(d.u1_gen_mu) > 0 ? N(d.u1_coal_mt) / (N(d.u1_gen_mu) * 1000) : 0;
    const scc_u2 = (d) => N(d.u2_gen_mu) > 0 ? N(d.u2_coal_mt) / (N(d.u2_gen_mu) * 1000) : 0;
    const scc_st = (d) => stationGen(d) > 0   ? stationCoal(d) / (stationGen(d) * 1000)   : 0;

    // Specific Oil (mL/kWh) = oil_KL / gen_MU
    const spOil_u1 = (d) => N(d.u1_gen_mu) > 0 ? N(d.u1_oil_ldo_kl) / N(d.u1_gen_mu) : 0;
    const spOil_u2 = (d) => N(d.u2_gen_mu) > 0 ? N(d.u2_oil_ldo_kl) / N(d.u2_gen_mu) : 0;
    const spOil_st = (d) => stationGen(d) > 0   ? stationOil(d) / stationGen(d)         : 0;

    // DM Water % = dm_m3 / run_hours / 1894.36 × 100
    const dmPct_u1 = (d) => N(d.u1_run_hours) > 0 ? (N(d.u1_dm_water_m3) / N(d.u1_run_hours) / 1894.36) * 100 : 0;
    const dmPct_u2 = (d) => N(d.u2_run_hours) > 0 ? (N(d.u2_dm_water_m3) / N(d.u2_run_hours) / 1894.36) * 100 : 0;
    const dmPct_st = (d) => {
        const rh = N(d.u1_run_hours) + N(d.u2_run_hours);
        return rh > 0 ? (stationDm(d) / rh / 1894.36) * 100 : 0;
    };

    // Specific Raw Water = raw_water_m3 / station_gen_MU / 1000
    const spRawWater = (d) => stationGen(d) > 0 ? N(d.raw_water_m3) / stationGen(d) / 1000 : 0;

    // Partial Loading % = SUM(grid_backing .. apc_margin) / DP_MU × 100
    const partialSum_u1 = (d) =>
        N(d.u1_grid_backing_mu) + N(d.u1_high_freq_mu) + N(d.u1_ramp_down_mu) +
        N(d.u1_ramp_up_mu) + N(d.u1_ash_handling_mu) + N(d.u1_equip_partial_mu) +
        N(d.u1_high_coal_mu) + N(d.u1_unit_stab_mu) + N(d.u1_rgmo_mu) +
        N(d.u1_iex_mu) + N(d.u1_apc_margin_mu);
    const partialSum_u2 = (d) =>
        N(d.u2_grid_backing_mu) + N(d.u2_high_freq_mu) + N(d.u2_ramp_down_mu) +
        N(d.u2_ramp_up_mu) + N(d.u2_ash_handling_mu) + N(d.u2_equip_partial_mu) +
        N(d.u2_high_coal_mu) + N(d.u2_unit_stab_mu) + N(d.u2_rgmo_mu) +
        N(d.u2_iex_mu) + N(d.u2_apc_margin_mu);

    const partialPct_u1 = (d) => pct(partialSum_u1(d), DP_MU);
    const partialPct_u2 = (d) => pct(partialSum_u2(d), DP_MU);
    const partialPct_st = (d) => pct(partialSum_u1(d) + partialSum_u2(d), DP_MU * 2);

    // Outage Loss % = total_outage_mu / DP_MU × 100
    const outagePct_u1 = (d) => pct(N(d.u1_total_outage_mu), DP_MU);
    const outagePct_u2 = (d) => pct(N(d.u2_total_outage_mu), DP_MU);
    const outagePct_st = (d) => pct(N(d.u1_total_outage_mu) + N(d.u2_total_outage_mu), DP_MU * 2);

    // DC Loss % = total_dc_loss_mu / dc_uppcl_mu × 100
    const dcLossPct_u1 = (d) => pct(N(d.u1_total_dc_loss_mu), N(d.dc_uppcl_mu));
    const dcLossPct_u2 = (d) => pct(N(d.u2_total_dc_loss_mu), N(d.dc_uppcl_mu));
    const dcLossPct_st = (d) => pct(N(d.u1_total_dc_loss_mu) + N(d.u2_total_dc_loss_mu), N(d.dc_uppcl_mu));

    // DSM / Net Saving in Lacs
    const dsmLacs = (d) => N(d.dsm_rs) / 100000;
    const netSavLacs = (d) => N(d.net_saving_rs) / 100000;

    // ── Row builders ─────────────────────────────────────────────────────────
    const makeRow = (label, uom, fn_u1, fn_u2, fn_st) => ({
        particulars: label, uom,
        daily_u1: fn_u1(r), daily_u2: fn_u2(r), daily_st: fn_st(r),
        mtd_u1: sumF(mtdRows, fn_u1), mtd_u2: sumF(mtdRows, fn_u2), mtd_st: sumF(mtdRows, fn_st),
        ytd_u1: sumF(ytdRows, fn_u1), ytd_u2: sumF(ytdRows, fn_u2), ytd_st: sumF(ytdRows, fn_st),
    });

    const makeAvgRow = (label, uom, fn_u1, fn_u2, fn_st) => ({
        particulars: label, uom,
        daily_u1: fn_u1(r), daily_u2: fn_u2(r), daily_st: fn_st(r),
        mtd_u1: avg(mtdRows, fn_u1), mtd_u2: avg(mtdRows, fn_u2), mtd_st: avg(mtdRows, fn_st),
        ytd_u1: avg(ytdRows, fn_u1), ytd_u2: avg(ytdRows, fn_u2), ytd_st: avg(ytdRows, fn_st),
    });

    const stationOnly = (label, uom, fn) => ({
        particulars: label, uom,
        daily_u1: null, daily_u2: null, daily_st: fn(r),
        mtd_u1: null, mtd_u2: null, mtd_st: sumF(mtdRows, fn),
        ytd_u1: null, ytd_u2: null, ytd_st: sumF(ytdRows, fn),
    });

    const stationOnlySnap = (label, uom, fn) => ({
        particulars: label, uom,
        daily_u1: null, daily_u2: null, daily_st: fn(r),
        mtd_u1: null, mtd_u2: null, mtd_st: null,
        ytd_u1: null, ytd_u2: null, ytd_st: null,
    });

    // ── Section A: Performance Parameters ─────────────────────────────────────
    const perfRows = [
        makeRow   ('Generation',         'MU',      d => N(d.u1_gen_mu), d => N(d.u2_gen_mu), stationGen),
        makeAvgRow('PLF',                '%',       plf_u1,   plf_u2,   plf_st),
        makeAvgRow('Average Load',       'MW',      avgLoad_u1, avgLoad_u2, avgLoad_st),
        makeAvgRow('Loading Factor',     '%',       lf_u1,    lf_u2,    lf_st),
        makeAvgRow('APC',                '%',       apcPct_u1, apcPct_u2, apcPct_st),
        stationOnly('SG',                'MU',      d => N(d.sg_mu)),
        stationOnly('AG (Net Export)',   'MU',      d => N(d.net_export_mu)),
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
        stationOnly('DSM',        '₹ Lacs', dsmLacs),
        stationOnly('Net Saving', '₹ Lacs', netSavLacs),
    ];

    // ── Section B: DC Loss ─────────────────────────────────────────────────────
    const lossRow = (label, fn_u1, fn_u2) => ({
        particulars: label, uom: 'MU',
        daily_u1: fn_u1(r), daily_u2: fn_u2(r), daily_st: fn_u1(r) + fn_u2(r),
        mtd_u1: sumF(mtdRows, fn_u1), mtd_u2: sumF(mtdRows, fn_u2), mtd_st: sumF(mtdRows, fn_u1) + sumF(mtdRows, fn_u2),
        ytd_u1: sumF(ytdRows, fn_u1), ytd_u2: sumF(ytdRows, fn_u2), ytd_st: sumF(ytdRows, fn_u1) + sumF(ytdRows, fn_u2),
    });

    const dcLossRows = [
        lossRow('BTL DC Loss',                d => N(d.u1_btl_loss_mu),        d => N(d.u2_btl_loss_mu)),
        lossRow('Equipment Problem DC Loss',  d => N(d.u1_equip_loss_mu),      d => N(d.u2_equip_loss_mu)),
        lossRow('Planned Outage DC Loss',     d => N(d.u1_planned_loss_mu),    d => N(d.u2_planned_loss_mu)),
        lossRow('Unit Trip DC Loss',          d => N(d.u1_trip_loss_mu),       d => N(d.u2_trip_loss_mu)),
        lossRow('Coal Constraint DC Loss',    d => N(d.u1_coal_constraint_mu), d => N(d.u2_coal_constraint_mu)),
        {
            particulars: 'Total DC Loss', uom: 'MU',
            daily_u1: N(r.u1_total_dc_loss_mu), daily_u2: N(r.u2_total_dc_loss_mu),
            daily_st: N(r.u1_total_dc_loss_mu) + N(r.u2_total_dc_loss_mu),
            mtd_u1: sum(mtdRows, 'u1_total_dc_loss_mu'), mtd_u2: sum(mtdRows, 'u2_total_dc_loss_mu'),
            mtd_st: sum(mtdRows, 'u1_total_dc_loss_mu') + sum(mtdRows, 'u2_total_dc_loss_mu'),
            ytd_u1: sum(ytdRows, 'u1_total_dc_loss_mu'), ytd_u2: sum(ytdRows, 'u2_total_dc_loss_mu'),
            ytd_st: sum(ytdRows, 'u1_total_dc_loss_mu') + sum(ytdRows, 'u2_total_dc_loss_mu'),
        },
        {
            particulars: 'DC Loss %', uom: '%',
            daily_u1: dcLossPct_u1(r), daily_u2: dcLossPct_u2(r), daily_st: dcLossPct_st(r),
            mtd_u1: avg(mtdRows, dcLossPct_u1), mtd_u2: avg(mtdRows, dcLossPct_u2), mtd_st: avg(mtdRows, dcLossPct_st),
            ytd_u1: avg(ytdRows, dcLossPct_u1), ytd_u2: avg(ytdRows, dcLossPct_u2), ytd_st: avg(ytdRows, dcLossPct_st),
        },
    ];

    // ── Section C: Partial Loading ──────────────────────────────────────────────
    const partialRows = [
        lossRow('Grid Backing Down',  d => N(d.u1_grid_backing_mu),  d => N(d.u2_grid_backing_mu)),
        lossRow('High Frequency',     d => N(d.u1_high_freq_mu),     d => N(d.u2_high_freq_mu)),
        lossRow('Ramp Down',          d => N(d.u1_ramp_down_mu),     d => N(d.u2_ramp_down_mu)),
        lossRow('Ramp Up',            d => N(d.u1_ramp_up_mu),       d => N(d.u2_ramp_up_mu)),
        lossRow('Ash Handling',       d => N(d.u1_ash_handling_mu),  d => N(d.u2_ash_handling_mu)),
        lossRow('Equipment Partial',  d => N(d.u1_equip_partial_mu), d => N(d.u2_equip_partial_mu)),
        lossRow('High Coal Cons.',    d => N(d.u1_high_coal_mu),     d => N(d.u2_high_coal_mu)),
        lossRow('Unit Stabilisation', d => N(d.u1_unit_stab_mu),     d => N(d.u2_unit_stab_mu)),
        lossRow('RGMO',               d => N(d.u1_rgmo_mu),          d => N(d.u2_rgmo_mu)),
        lossRow('IEX',                d => N(d.u1_iex_mu),           d => N(d.u2_iex_mu)),
        lossRow('APC Margin',         d => N(d.u1_apc_margin_mu),    d => N(d.u2_apc_margin_mu)),
        {
            particulars: 'Total Partial Loading', uom: 'MU',
            daily_u1: partialSum_u1(r), daily_u2: partialSum_u2(r), daily_st: partialSum_u1(r) + partialSum_u2(r),
            mtd_u1: sumF(mtdRows, partialSum_u1), mtd_u2: sumF(mtdRows, partialSum_u2), mtd_st: sumF(mtdRows, partialSum_u1) + sumF(mtdRows, partialSum_u2),
            ytd_u1: sumF(ytdRows, partialSum_u1), ytd_u2: sumF(ytdRows, partialSum_u2), ytd_st: sumF(ytdRows, partialSum_u1) + sumF(ytdRows, partialSum_u2),
        },
        {
            particulars: 'Partial Loading %', uom: '%',
            daily_u1: partialPct_u1(r), daily_u2: partialPct_u2(r), daily_st: partialPct_st(r),
            mtd_u1: avg(mtdRows, partialPct_u1), mtd_u2: avg(mtdRows, partialPct_u2), mtd_st: avg(mtdRows, partialPct_st),
            ytd_u1: avg(ytdRows, partialPct_u1), ytd_u2: avg(ytdRows, partialPct_u2), ytd_st: avg(ytdRows, partialPct_st),
        },
    ];

    // ── Section D: Outages ─────────────────────────────────────────────────────
    const outageRows = [
        {
            particulars: 'Outage Loss', uom: 'MU',
            daily_u1: N(r.u1_total_outage_mu), daily_u2: N(r.u2_total_outage_mu),
            daily_st: N(r.u1_total_outage_mu) + N(r.u2_total_outage_mu),
            mtd_u1: sum(mtdRows, 'u1_total_outage_mu'), mtd_u2: sum(mtdRows, 'u2_total_outage_mu'),
            mtd_st: sum(mtdRows, 'u1_total_outage_mu') + sum(mtdRows, 'u2_total_outage_mu'),
            ytd_u1: sum(ytdRows, 'u1_total_outage_mu'), ytd_u2: sum(ytdRows, 'u2_total_outage_mu'),
            ytd_st: sum(ytdRows, 'u1_total_outage_mu') + sum(ytdRows, 'u2_total_outage_mu'),
        },
        {
            particulars: 'Outage Loss %', uom: '%',
            daily_u1: outagePct_u1(r), daily_u2: outagePct_u2(r), daily_st: outagePct_st(r),
            mtd_u1: avg(mtdRows, outagePct_u1), mtd_u2: avg(mtdRows, outagePct_u2), mtd_st: avg(mtdRows, outagePct_st),
            ytd_u1: avg(ytdRows, outagePct_u1), ytd_u2: avg(ytdRows, outagePct_u2), ytd_st: avg(ytdRows, outagePct_st),
        },
        {
            particulars: 'No. of Trips', uom: 'Nos',
            daily_u1: N(r.u1_no_trips), daily_u2: N(r.u2_no_trips), daily_st: N(r.u1_no_trips) + N(r.u2_no_trips),
            mtd_u1: sum(mtdRows, 'u1_no_trips'), mtd_u2: sum(mtdRows, 'u2_no_trips'),
            mtd_st: sum(mtdRows, 'u1_no_trips') + sum(mtdRows, 'u2_no_trips'),
            ytd_u1: sum(ytdRows, 'u1_no_trips'), ytd_u2: sum(ytdRows, 'u2_no_trips'),
            ytd_st: sum(ytdRows, 'u1_no_trips') + sum(ytdRows, 'u2_no_trips'),
        },
    ];

    // ── Section E: APC & Oil ───────────────────────────────────────────────────
    const apcOilRows = [
        makeAvgRow('APC',                     '%',       apcPct_u1,  apcPct_u2,  apcPct_st),
        makeRow   ('LDO Consumption',         'KL',      d => N(d.u1_oil_ldo_kl), d => N(d.u2_oil_ldo_kl), stationOil),
        makeAvgRow('Specific Oil Consumption','mL/kWh',  spOil_u1,   spOil_u2,   spOil_st),
    ];

    // ── Section F: Coal ────────────────────────────────────────────────────────
    const coalRows = [
        makeRow   ('Coal Consumption',          'MT',     d => N(d.u1_coal_mt), d => N(d.u2_coal_mt), stationCoal),
        makeAvgRow('Specific Coal Consumption', 'kg/kWh', scc_u1, scc_u2, scc_st),
        stationOnly ('Coal Received',           'MT',     d => N(d.coal_received_mt)),
        stationOnlySnap('Coal Stock (Usable)',  'MT',     d => N(d.coal_stock_mt)),
    ];

    // ── Section G: Water ───────────────────────────────────────────────────────
    const waterRows = [
        makeRow   ('DM Water Consumption',        'M³',     d => N(d.u1_dm_water_m3), d => N(d.u2_dm_water_m3), stationDm),
        makeAvgRow('DM Water % (Hot-well makeup)','%',      dmPct_u1, dmPct_u2, dmPct_st),
        stationOnly('Raw Water Consumption',      'M³',     d => N(d.raw_water_m3)),
        {
            particulars: 'Specific Raw Water', uom: 'M³/MU',
            daily_u1: null, daily_u2: null, daily_st: spRawWater(r),
            mtd_u1: null, mtd_u2: null, mtd_st: avg(mtdRows, spRawWater),
            ytd_u1: null, ytd_u2: null, ytd_st: avg(ytdRows, spRawWater),
        },
        makeRow('H2 Cylinders', 'Nos/day', d => N(d.u1_h2_cylinders), d => N(d.u2_h2_cylinders), stationH2),
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
            { title: 'A. PERFORMANCE PARAMETERS',    rows: perfRows },
            { title: 'B. DC LOSS',                   rows: dcLossRows },
            { title: 'C. PARTIAL LOADING',           rows: partialRows },
            { title: 'D. OUTAGES',                   rows: outageRows },
            { title: 'E. APC & OIL',                 rows: apcOilRows },
            { title: 'F. COAL',                      rows: coalRows },
            { title: 'G. WATER',                     rows: waterRows },
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
