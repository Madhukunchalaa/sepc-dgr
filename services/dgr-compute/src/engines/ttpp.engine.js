// services/dgr-compute/src/engines/ttpp.engine.js
const {
    getPowerData, getFuelData, getPerfData, getWaterData,
    getAshData, getDsmData, getAvailabilityData, getSchedulingData,
    getOpsLog, getMTDSum, getYTDSum, getMTDAvg, getYTDAvg,
    processNumbers, getSubmissionStatus
} = require('./helpers');

async function assembleTtppDGR(plant, targetDate) {
    const plantId = plant.id;

    // T-2 date for GHR/GCV (Excel uses 2-day lag for lab analysis)
    const t2Date = (() => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - 2);
        return d.toISOString().split('T')[0];
    })();
    const t2Label = new Date(t2Date)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        .replace(/ /g, '-');

    const [
        power, fuel, perf, water, availability, scheduling, ash, dsm, opsLog, perfT2, fuelT2,
    ] = await Promise.all([
        getPowerData(plantId, targetDate), getFuelData(plantId, targetDate),
        getPerfData(plantId, targetDate), getWaterData(plantId, targetDate), getAvailabilityData(plantId, targetDate),
        getSchedulingData(plantId, targetDate), getAshData(plantId, targetDate), getDsmData(plantId, targetDate),
        getOpsLog(plantId, targetDate),
        getPerfData(plantId, t2Date), getFuelData(plantId, t2Date),
    ]);

    const date = new Date(targetDate);

    // Compute live engine variables according to Excel DGR logic
    const genMu = Number(power?.generation_mu || 0);
    const coalMt = Number(fuel?.coal_cons_mt || 0);
    const ldoKl = Number(fuel?.ldo_cons_kl || 0);
    const hfoKl = Number(fuel?.hfo_cons_kl || 0);

    // GCV and GHR use T-2 date (lab analysis lag — matches Excel exactly)
    const gcvAf = Number(perfT2?.gcv_af || fuelT2?.coal_gcv_af || perf?.gcv_af || fuel?.coal_gcv_af || 0);
    // GHR (kCal/kWh) = (GCV × Coal_MT × 1000 + Oil_KL × 10700) / (Gen_MU × 1,000,000)
    const _t2Coal = Number(fuelT2?.coal_cons_mt || 0);
    const _t2Ldo  = Number(fuelT2?.ldo_cons_kl  || 0);
    const _t2Hfo  = Number(fuelT2?.hfo_cons_kl  || 0);
    const _t2Gen  = Number((await getPowerData(plantId, t2Date))?.generation_mu || 0);
    const ghrT2 = perfT2?.ghr_direct != null && Number(perfT2.ghr_direct) > 0
        ? Number(perfT2.ghr_direct)
        : (gcvAf > 0 && _t2Coal > 0 && _t2Gen > 0
            ? ((gcvAf * _t2Coal * 1000) + (_t2Ldo + _t2Hfo) * 10700) / (_t2Gen * 1000000)
            : null);
    const ghrLabel = `GHR (As Fired) as on ${t2Label}`;
    const gcvLabel = `GCV (As Fired) as on ${t2Label}`;

    // Computed daily values (fallbacks for missing DB columns)
    const exportMu = Number(power?.export_mu || 0);
    const importMu = Number(power?.import_mu || 0);
    const netExportDaily = exportMu - importMu;
    const apcDaily = power?.apc_mu != null ? Number(power.apc_mu) : (genMu > 0 ? genMu - netExportDaily : null);
    const avgLoadMw = power?.avg_load_mw != null ? Number(power.avg_load_mw) : (genMu > 0 ? genMu * 1000 / 24 : null);
    const socDaily = fuel?.soc_ml_kwh != null ? Number(fuel.soc_ml_kwh) : (genMu > 0 ? ((ldoKl + hfoKl) * 1000) / (genMu * 1000) : null);
    const sccDaily = fuel?.scc_kg_kwh != null ? Number(fuel.scc_kg_kwh) : (genMu > 0 ? coalMt / (genMu * 1000) : null);
    const apcPctDaily = genMu > 0 && apcDaily != null ? (apcDaily / genMu) * 100 : null;

    const apcMtd = await getMTDSum(plantId, targetDate, 'apc_mu');
    const apcYtd = await getYTDSum(plantId, targetDate, 'apc_mu');
    const genMtd = Number(power?.generation_mtd || (await getMTDSum(plantId, targetDate, 'generation_mu')));
    const genYtd = Number(power?.generation_ytd || (await getYTDSum(plantId, targetDate, 'generation_mu')));

    // Format hours as HH:MM — matches Excel display (no "D" prefix)
    const formatHours = (hrs) => {
        if (hrs == null) return null;
        const n = Number(hrs);
        const h = Math.floor(n);
        const mm = Math.round((n % 1) * 60);
        return h + ':' + String(mm).padStart(2, '0');
    };

    // Return null instead of 0 for optional meter values (matches Excel blank cells)
    const nz = (v) => (v == null || Number(v) === 0) ? null : Number(v);

    const getDcLossRemarks = () => {
        try {
            const reasons = (typeof scheduling?.dc_loss_reasons === 'string' ? JSON.parse(scheduling.dc_loss_reasons) : scheduling?.dc_loss_reasons) || [];
            if (!reasons.length) return 'Nil';
            return reasons.map(r => `${r.reason}: ${r.mu}MU`).join(', ');
        } catch (e) { return 'Nil'; }
    };

    // Format grid frequency — strip trailing zeros (49.950 → 49.95, 50.000 → 50)
    const fmtFreq = (v) => {
        if (v == null) return null;
        return parseFloat(Number(v).toFixed(3)).toString();
    };

    const formatLoss = (mu, pct) => mu != null ? `${mu} / ${pct ?? 0}%` : null;

    const ldoMtd = await getMTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel');
    const hfoMtd = await getMTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel');
    const socMtd = Number(genMtd) > 0 ? (Number(ldoMtd) + Number(hfoMtd)) / Number(genMtd) : 0;

    const ldoYtd = await getYTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel');
    const hfoYtd = await getYTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel');
    const socYtd = Number(genYtd) > 0 ? (Number(ldoYtd) + Number(hfoYtd)) / Number(genYtd) : 0;

    const coalMtd = await getMTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel');
    const coalYtd = await getYTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel');
    const sccMtd = Number(genMtd) > 0 ? Number(coalMtd) / (Number(genMtd) * 1000) : 0;
    const sccYtd = Number(genYtd) > 0 ? Number(coalYtd) / (Number(genYtd) * 1000) : 0;

    const report = {
        header: {
            title: `DAILY GENERATION REPORT — ${plant?.fy_label || ''}`,
            company: plant?.company_name || 'SEPC Power Pvt Ltd',
            plantName: plant?.name || 'Plant',
            documentNumber: plant?.document_number || '',
            date: targetDate,
            dayName: date.toLocaleDateString('en-IN', { weekday: 'long' }),
            monthYear: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            fyLabel: plant?.fy_label || '',
        },
        sections: [
            {
                title: "1️⃣ POWER",
                rows: [
                    { sn: "1.1", particulars: "Power Generation", uom: "MU", daily: power?.generation_mu, mtd: power?.generation_mtd || await getMTDSum(plantId, targetDate, 'generation_mu'), ytd: power?.generation_ytd || await getYTDSum(plantId, targetDate, 'generation_mu') },
                    { sn: "1.2", particulars: "Average Power Generation", uom: "MW", daily: avgLoadMw, mtd: await getMTDAvg(plantId, targetDate, 'avg_load_mw'), ytd: await getYTDAvg(plantId, targetDate, 'avg_load_mw') },
                    { sn: "1.3", particulars: "Total Export (GT)", uom: "MU", daily: power?.export_mu, mtd: await getMTDSum(plantId, targetDate, 'export_mu'), ytd: await getYTDSum(plantId, targetDate, 'export_mu') },
                    { sn: "1.4", particulars: "Total Import (GT)", uom: "MU", daily: nz(power?.import_mu), mtd: nz(await getMTDSum(plantId, targetDate, 'import_mu')), ytd: nz(await getYTDSum(plantId, targetDate, 'import_mu')) },
                    { sn: "1.5", particulars: "Net Export (GT Export − GT Import)", uom: "MU", daily: power?.export_mu != null ? netExportDaily : null, mtd: (await getMTDSum(plantId, targetDate, 'export_mu')) - (await getMTDSum(plantId, targetDate, 'import_mu')), ytd: (await getYTDSum(plantId, targetDate, 'export_mu')) - (await getYTDSum(plantId, targetDate, 'import_mu')) },
                    { sn: "1.6", particulars: "Auxiliary Power Consumption (APC incl Import)", uom: "MU", daily: apcDaily, mtd: apcMtd, ytd: apcYtd },
                    { sn: "1.7", particulars: "APC %", uom: "%", daily: apcPctDaily, mtd: genMtd > 0 ? (apcMtd / genMtd) * 100 : 0, ytd: genYtd > 0 ? (apcYtd / genYtd) * 100 : 0 },
                    { sn: "1.8", particulars: "Hours on Grid", uom: "D(s) HH:MM", daily: formatHours(power?.hours_on_grid), mtd: null, ytd: null },
                    { sn: "1.9", particulars: "Grid Frequency", uom: "Hz", daily: (power?.freq_min || power?.freq_max || power?.freq_avg) ? `Min - ${fmtFreq(power.freq_min)} Hz / Max - ${fmtFreq(power.freq_max)} Hz / Avg - ${fmtFreq(power.freq_avg)} Hz` : null, mtd: null, ytd: null }
                ]
            },
            {
                title: "2️⃣ PERFORMANCE",
                rows: [
                    { sn: "2.1", particulars: "Plant Load Factor", uom: "%", daily: power?.plf_daily != null ? Number(power.plf_daily) * 100 : null, mtd: power?.plf_mtd != null ? Number(power.plf_mtd) * 100 : (await getMTDAvg(plantId, targetDate, 'plf_daily')) * 100, ytd: power?.plf_ytd != null ? Number(power.plf_ytd) * 100 : (await getYTDAvg(plantId, targetDate, 'plf_daily')) * 100 },
                    { sn: "2.2", particulars: "Partial Loading", uom: "%", daily: power?.plf_daily != null && Number(power.plf_daily) > 0 ? Math.max(0, 1 - Number(power.plf_daily)) * 100 : null, mtd: (power?.plf_mtd != null || await getMTDAvg(plantId, targetDate, 'plf_daily') > 0) ? Math.max(0, 1 - (power?.plf_mtd != null ? Number(power.plf_mtd) : await getMTDAvg(plantId, targetDate, 'plf_daily'))) * 100 : null, ytd: (power?.plf_ytd != null || await getYTDAvg(plantId, targetDate, 'plf_daily') > 0) ? Math.max(0, 1 - (power?.plf_ytd != null ? Number(power.plf_ytd) : await getYTDAvg(plantId, targetDate, 'plf_daily'))) * 100 : null },
                    { sn: "2.3", particulars: "Plant Availability Factor (SEPC)", uom: "%", daily: availability?.paf_pct != null ? Number(availability.paf_pct) * 100 : null, mtd: availability?.paf_mtd != null ? Number(availability.paf_mtd) * 100 : (await getMTDAvg(plantId, targetDate, 'paf_pct', 'daily_availability')) * 100, ytd: availability?.paf_ytd != null ? Number(availability.paf_ytd) * 100 : (await getYTDAvg(plantId, targetDate, 'paf_pct', 'daily_availability')) * 100 },
                    { sn: "2.4", particulars: "Plant Availability Factor (TNPDCL)", uom: "%", daily: availability?.paf_tnpdcl != null ? Number(availability.paf_tnpdcl) * 100 : null, mtd: availability?.paf_tnpdcl_mtd != null ? Number(availability.paf_tnpdcl_mtd) * 100 : (await getMTDAvg(plantId, targetDate, 'paf_tnpdcl', 'daily_availability')) * 100, ytd: availability?.paf_tnpdcl_ytd != null ? Number(availability.paf_tnpdcl_ytd) * 100 : (await getYTDAvg(plantId, targetDate, 'paf_tnpdcl', 'daily_availability')) * 100 },
                    { sn: "2.5", particulars: "Plant Outage – Forced", uom: "Count", daily: power?.forced_outages, mtd: await getMTDSum(plantId, targetDate, 'forced_outages'), ytd: await getYTDSum(plantId, targetDate, 'forced_outages') },
                    { sn: "2.6", particulars: "Plant Outage – Planned", uom: "Count", daily: power?.planned_outages, mtd: await getMTDSum(plantId, targetDate, 'planned_outages'), ytd: await getYTDSum(plantId, targetDate, 'planned_outages') },
                    { sn: "2.7", particulars: "Plant Outage – RSD", uom: "Count", daily: power?.rsd_count, mtd: await getMTDSum(plantId, targetDate, 'rsd_count'), ytd: await getYTDSum(plantId, targetDate, 'rsd_count') },
                    { sn: "2.8", particulars: "Specific Oil Consumption", uom: "ml/kWh", daily: socDaily, mtd: socMtd, ytd: socYtd },
                    { sn: "2.9", particulars: "Specific Coal Consumption", uom: "kg/kWh", daily: sccDaily, mtd: sccMtd, ytd: sccYtd },
                    { sn: "2.10", particulars: ghrLabel, uom: "kCal/kWh", daily: ghrT2, mtd: null, ytd: null },
                    { sn: "2.11", particulars: "GHR Remarks", uom: "Text", daily: perfT2?.ghr_remarks || perf?.ghr_remarks, mtd: null, ytd: null },
                    { sn: "2.12", particulars: gcvLabel, uom: "kCal/kg", daily: gcvAf || null, mtd: null, ytd: null },
                ]
            },
            {
                title: "3️⃣ CONSUMPTION & STOCK",
                rows: [
                    { sn: "3.1", particulars: "LDO Consumption", uom: "KL", daily: fuel?.ldo_cons_kl, mtd: await getMTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel') },
                    { sn: "3.2", particulars: "HFO Consumption", uom: "KL", daily: fuel?.hfo_cons_kl, mtd: await getMTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel') },
                    { sn: "3.3", particulars: "Coal Consumption", uom: "MT", daily: fuel?.coal_cons_mt, mtd: await getMTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel') },
                    { sn: "3.4", particulars: "LDO Receipt", uom: "KL", daily: fuel?.ldo_receipt_kl, mtd: await getMTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel') },
                    { sn: "3.5", particulars: "HFO Receipt", uom: "KL", daily: nz(fuel?.hfo_receipt_kl), mtd: nz(await getMTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel')), ytd: nz(await getYTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel')) },
                    { sn: "3.6", particulars: "Coal Receipt", uom: "MT", daily: fuel?.coal_receipt_mt, mtd: await getMTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel') },
                    { sn: "3.7", particulars: "LDO Total / Usable Stock", uom: "KL", daily: fuel?.ldo_stock_kl, mtd: null, ytd: null },
                    { sn: "3.8", particulars: "HFO Total / Usable Stock", uom: "KL", daily: fuel?.hfo_stock_kl, mtd: null, ytd: null },
                    { sn: "3.9", particulars: "Coal Stock", uom: "MT", daily: nz(fuel?.coal_stock_mt), mtd: null, ytd: null },
                    { sn: "3.10", particulars: "DM Water Consumption (Cycle Makeup)", uom: "m³", daily: water?.dm_cycle_makeup_m3, mtd: await getMTDSum(plantId, targetDate, 'dm_cycle_makeup_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'dm_cycle_makeup_m3', 'daily_water') },
                    { sn: "3.11", particulars: "Total DM Water Consumption (Plant)", uom: "m³", daily: water?.dm_total_cons_m3, mtd: await getMTDSum(plantId, targetDate, 'dm_total_cons_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'dm_total_cons_m3', 'daily_water') },
                    { sn: "3.12", particulars: "Service Water Consumption", uom: "m³", daily: water?.service_water_m3, mtd: await getMTDSum(plantId, targetDate, 'service_water_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'service_water_m3', 'daily_water') },
                    { sn: "3.13", particulars: "Potable Water Consumption", uom: "m³", daily: water?.potable_water_m3, mtd: await getMTDSum(plantId, targetDate, 'potable_water_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'potable_water_m3', 'daily_water') },
                    { sn: "3.14", particulars: "Sea Water Consumption", uom: "m³", daily: water?.sea_water_m3, mtd: await getMTDSum(plantId, targetDate, 'sea_water_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'sea_water_m3', 'daily_water') },
                    { sn: "3.15", particulars: "H₂ Consumption", uom: "Nos", daily: fuel?.h2_cons, mtd: await getMTDSum(plantId, targetDate, 'h2_cons', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'h2_cons', 'daily_fuel') },
                    { sn: "3.16", particulars: "CO₂ Consumption", uom: "Nos", daily: fuel?.co2_cons, mtd: await getMTDSum(plantId, targetDate, 'co2_cons', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'co2_cons', 'daily_fuel') },
                    { sn: "3.17", particulars: "N₂ Consumption", uom: "Nos", daily: fuel?.n2_cons, mtd: await getMTDSum(plantId, targetDate, 'n2_cons', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'n2_cons', 'daily_fuel') },
                    { sn: "3.18", particulars: "H₂ Stock", uom: "Nos", daily: fuel?.h2_stock, mtd: null, ytd: null },
                    { sn: "3.19", particulars: "CO₂ Stock", uom: "Nos", daily: fuel?.co2_stock, mtd: null, ytd: null },
                    { sn: "3.20", particulars: "N₂ Stock", uom: "Nos", daily: fuel?.n2_stock, mtd: null, ytd: null },
                ]
            },
            {
                title: "4️⃣ POWER SCHEDULE",
                rows: [
                    { sn: "4.1", particulars: "Declared Capacity (SEPC)", uom: "MU", daily: scheduling?.dc_sepc_mu, mtd: await getMTDSum(plantId, targetDate, 'dc_sepc_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'dc_sepc_mu', 'daily_scheduling') },
                    { sn: "4.2", particulars: "Declared Capacity (TNPDCL)", uom: "MU", daily: scheduling?.dc_tnpdcl_mu, mtd: await getMTDSum(plantId, targetDate, 'dc_tnpdcl_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'dc_tnpdcl_mu', 'daily_scheduling') },
                    { sn: "4.3", particulars: "Schedule Generation (SG – PPA)", uom: "MU", daily: scheduling?.sg_ppa_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling') },
                    { sn: "4.4", particulars: "Schedule Generation (SG – DAM)", uom: "MU", daily: nz(scheduling?.sg_dam_mu), mtd: nz(await getMTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')), ytd: nz(await getYTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')) },
                    { sn: "4.5", particulars: "Schedule Generation (SG – RTM)", uom: "MU", daily: nz(scheduling?.sg_rtm_mu), mtd: nz(await getMTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling')), ytd: nz(await getYTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling')) },
                    { sn: "4.6", particulars: "Total Schedule Generation", uom: "MU", daily: (Number(scheduling?.sg_ppa_mu||0) + Number(scheduling?.sg_dam_mu||0) + Number(scheduling?.sg_rtm_mu||0)) || null, mtd: (Number(await getMTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling')) + Number(await getMTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')) + Number(await getMTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'))) || null, ytd: (Number(await getYTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling')) + Number(await getYTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')) + Number(await getYTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'))) || null },
                    { sn: "4.7", particulars: "Asking Rate to Achieve 80% DC", uom: "MW", daily: scheduling?.asking_rate_mw, mtd: null, ytd: null },
                    { sn: "4.8", particulars: "Deemed Generation – DG (TB + RSD)", uom: "MU", daily: scheduling?.deemed_gen_mu, mtd: await getMTDSum(plantId, targetDate, 'deemed_gen_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'deemed_gen_mu', 'daily_scheduling') },
                    { sn: "4.9", particulars: "DC Loss (Capacity − DC SEPC)", uom: "%", daily: scheduling?.dc_tnpdcl_mu > 0 ? ((1 - ((scheduling.dc_sepc_mu || 0) / scheduling.dc_tnpdcl_mu)) * 100).toFixed(2) : 0, mtd: null, ytd: null },
                    { sn: "4.10", particulars: "DC Loss Reason – Daily", uom: "Text", daily: getDcLossRemarks(), mtd: null, ytd: null }
                ]
            },
            {
                title: "5️⃣ ASH",
                rows: [
                    { sn: "5.1", particulars: "Fly Ash to User", uom: "MT", daily: ash?.fa_to_user_mt, mtd: await getMTDSum(plantId, targetDate, 'fa_to_user_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'fa_to_user_mt', 'daily_ash') },
                    { sn: "5.2", particulars: "Fly Ash to Dyke / Internal", uom: "MT", daily: nz(ash?.fa_to_dyke_mt), mtd: nz(await getMTDSum(plantId, targetDate, 'fa_to_dyke_mt', 'daily_ash')), ytd: nz(await getYTDSum(plantId, targetDate, 'fa_to_dyke_mt', 'daily_ash')) },
                    { sn: "5.3", particulars: "Bottom Ash to User", uom: "MT", daily: ash?.ba_to_user_mt, mtd: await getMTDSum(plantId, targetDate, 'ba_to_user_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'ba_to_user_mt', 'daily_ash') },
                    { sn: "5.4", particulars: "Bottom Ash to Dyke / Internal", uom: "MT", daily: nz(ash?.ba_to_dyke_mt), mtd: nz(await getMTDSum(plantId, targetDate, 'ba_to_dyke_mt', 'daily_ash')), ytd: nz(await getYTDSum(plantId, targetDate, 'ba_to_dyke_mt', 'daily_ash')) },
                    { sn: "5.5", particulars: "Fly Ash Generated", uom: "MT", daily: ash?.fa_generated_mt, mtd: await getMTDSum(plantId, targetDate, 'fa_generated_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'fa_generated_mt', 'daily_ash') },
                    { sn: "5.6", particulars: "Bottom & Eco Ash Generated", uom: "MT", daily: ash?.ba_generated_mt, mtd: await getMTDSum(plantId, targetDate, 'ba_generated_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'ba_generated_mt', 'daily_ash') },
                    { sn: "5.7", particulars: "Fly Ash in Silo", uom: "MT", daily: ash?.fa_silo_mt, mtd: null, ytd: null },
                    { sn: "5.8", particulars: "Bottom Ash in Silo", uom: "MT", daily: ash?.ba_silo_mt, mtd: null, ytd: null },
                ]
            },
            {
                title: "6️⃣ WATER",
                rows: [
                    { sn: "6.1", particulars: "IDCT Make Up (Sea Water)", uom: "m³", daily: water?.idct_makeup_m3, mtd: await getMTDSum(plantId, targetDate, 'idct_makeup_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'idct_makeup_m3', 'daily_water') },
                    { sn: "6.2", particulars: "SWI Flow", uom: "m³", daily: water?.swi_flow_m3, mtd: await getMTDSum(plantId, targetDate, 'swi_flow_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'swi_flow_m3', 'daily_water') },
                    { sn: "6.3", particulars: "Outfall (CT Blowdown & WTP Reject)", uom: "m³", daily: water?.outfall_m3, mtd: await getMTDSum(plantId, targetDate, 'outfall_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'outfall_m3', 'daily_water') },
                    { sn: "6.4", particulars: "Specific Water Consumption", uom: "m³/MWh", daily: (genMu > 0 && Number(water?.sea_water_m3||0) > 0) ? Number(water.sea_water_m3) / (genMu * 1000) : null, mtd: null, ytd: null },
                    { sn: "6.5", particulars: "DM Water Generation", uom: "m³", daily: water?.dm_generation_m3, mtd: await getMTDSum(plantId, targetDate, 'dm_generation_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'dm_generation_m3', 'daily_water') },
                    { sn: "6.6", particulars: "Filtered / Service Water Generation", uom: "m³", daily: water?.filtered_water_gen_m3, mtd: await getMTDSum(plantId, targetDate, 'filtered_water_gen_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'filtered_water_gen_m3', 'daily_water') },
                    { sn: "6.7", particulars: "DM Water Total / Usable Stock", uom: "m³", daily: water?.dm_stock_m3, mtd: null, ytd: null },
                    { sn: "6.8", particulars: "Service Water Total / Usable Stock", uom: "m³", daily: water?.service_water_stock_m3, mtd: null, ytd: null }
                ]
            },
            {
                title: "7️⃣ DSM (Till Date)",
                rows: [
                    { sn: "7.1", particulars: "DSM Net Profit", uom: "Lacs", daily: dsm?.dsm_net_profit_lacs != null ? Number(dsm.dsm_net_profit_lacs) / 100000 : null, mtd: null, ytd: (await getYTDSum(plantId, targetDate, 'dsm_net_profit_lacs', 'daily_dsm')) / 100000 },
                    { sn: "7.2", particulars: "DSM Payable by SEPC", uom: "Lacs", daily: dsm?.dsm_payable_lacs != null ? Number(dsm.dsm_payable_lacs) / 100000 : null, mtd: null, ytd: (await getYTDSum(plantId, targetDate, 'dsm_payable_lacs', 'daily_dsm')) / 100000 },
                    { sn: "7.3", particulars: "DSM Receivable by SEPC", uom: "Lacs", daily: dsm?.dsm_receivable_lacs != null ? Number(dsm.dsm_receivable_lacs) / 100000 : null, mtd: null, ytd: (await getYTDSum(plantId, targetDate, 'dsm_receivable_lacs', 'daily_dsm')) / 100000 },
                    { sn: "7.4", particulars: "DSM Coal Saving / (+Loss) by SEPC", uom: "Lacs", daily: dsm?.dsm_coal_saving_lacs != null ? Number(dsm.dsm_coal_saving_lacs) / 100000 : null, mtd: null, ytd: (await getYTDSum(plantId, targetDate, 'dsm_coal_saving_lacs', 'daily_dsm')) / 100000 }
                ]
            },
            {
                title: "8️⃣ URS PROFIT / LOSS",
                rows: [
                    { sn: "8.1", particulars: "URS Net Profit", uom: "Lacs", daily: scheduling?.urs_net_profit_lacs, mtd: await getMTDSum(plantId, targetDate, 'urs_net_profit_lacs', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'urs_net_profit_lacs', 'daily_scheduling') }
                ]
            },
            {
                title: "9️⃣ DC LOSS B/U (Capacity – DC TNPDCL)",
                rows: [
                    { sn: "9.1", particulars: "Coal Shortage", uom: "MU / %", daily: formatLoss(scheduling?.loss_coal_mu, scheduling?.loss_coal_pct), mtd: formatLoss(await getMTDSum(plantId, targetDate, 'loss_coal_mu', 'daily_scheduling'), await getMTDAvg(plantId, targetDate, 'loss_coal_pct', 'daily_scheduling')), ytd: formatLoss(await getYTDSum(plantId, targetDate, 'loss_coal_mu', 'daily_scheduling'), await getYTDAvg(plantId, targetDate, 'loss_coal_pct', 'daily_scheduling')) },
                    { sn: "9.2", particulars: "CRE to SMPS Failure Trip", uom: "MU / %", daily: formatLoss(scheduling?.loss_cre_smps_mu, scheduling?.loss_cre_smps_pct), mtd: formatLoss(await getMTDSum(plantId, targetDate, 'loss_cre_smps_mu', 'daily_scheduling'), await getMTDAvg(plantId, targetDate, 'loss_cre_smps_pct', 'daily_scheduling')), ytd: formatLoss(await getYTDSum(plantId, targetDate, 'loss_cre_smps_mu', 'daily_scheduling'), await getYTDAvg(plantId, targetDate, 'loss_cre_smps_pct', 'daily_scheduling')) },
                    { sn: "9.3", particulars: "Bunker Choke", uom: "MU / %", daily: formatLoss(scheduling?.loss_bunker_mu, scheduling?.loss_bunker_pct), mtd: formatLoss(await getMTDSum(plantId, targetDate, 'loss_bunker_mu', 'daily_scheduling'), await getMTDAvg(plantId, targetDate, 'loss_bunker_pct', 'daily_scheduling')), ytd: formatLoss(await getYTDSum(plantId, targetDate, 'loss_bunker_mu', 'daily_scheduling'), await getYTDAvg(plantId, targetDate, 'loss_bunker_pct', 'daily_scheduling')) },
                    { sn: "9.4", particulars: "AOH", uom: "MU / %", daily: formatLoss(scheduling?.loss_aoh_mu, scheduling?.loss_aoh_pct), mtd: formatLoss(await getMTDSum(plantId, targetDate, 'loss_aoh_mu', 'daily_scheduling'), await getMTDAvg(plantId, targetDate, 'loss_aoh_pct', 'daily_scheduling')), ytd: formatLoss(await getYTDSum(plantId, targetDate, 'loss_aoh_mu', 'daily_scheduling'), await getYTDAvg(plantId, targetDate, 'loss_aoh_pct', 'daily_scheduling')) },
                    { sn: "9.5", particulars: "Low Vacuum Trip", uom: "MU / %", daily: formatLoss(scheduling?.loss_vacuum_mu, scheduling?.loss_vacuum_pct), mtd: formatLoss(await getMTDSum(plantId, targetDate, 'loss_vacuum_mu', 'daily_scheduling'), await getMTDAvg(plantId, targetDate, 'loss_vacuum_pct', 'daily_scheduling')), ytd: formatLoss(await getYTDSum(plantId, targetDate, 'loss_vacuum_mu', 'daily_scheduling'), await getYTDAvg(plantId, targetDate, 'loss_vacuum_pct', 'daily_scheduling')) }
                ]
            },
            {
                title: "🔟 ACTIVITIES / REMARKS",
                rows: [
                    { sn: "10.1", particulars: "Major Activities", uom: "Text", daily: (opsLog?.boiler_activities || '') + ' ' + (opsLog?.turbine_activities || '') + ' ' + (opsLog?.electrical_activities || '') + ' ' + (opsLog?.bop_activities || ''), mtd: null, ytd: null },
                    { sn: "10.2", particulars: "Remarks", uom: "Text", daily: opsLog?.remarks || '', mtd: null, ytd: null },
                    { sn: "10.3", particulars: "Observations", uom: "Text", daily: opsLog?.observations || '', mtd: null, ytd: null }
                ]
            }
        ],
        meta: {
            submissionStatus: await getSubmissionStatus(plantId, targetDate),
            generatedAt: new Date().toISOString(),
            plantId,
            targetDate,
        },
    };

    report.sections = processNumbers(report.sections);
    return report;
}

module.exports = { assembleTtppDGR };
