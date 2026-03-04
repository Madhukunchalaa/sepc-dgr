// services/dgr-compute/src/engines/dgr.engine.js
// Replicates all Excel VLOOKUP + formula logic in pure JS + SQL
const { query } = require('../shared/db');

// ── Master DGR assembler — mirrors your Excel DGR sheet exactly ──
async function assembleDGR(plantId, targetDate) {
    const [
        plant, power, fuel, perf, water, availability, scheduling, ash, dsm, opsLog,
    ] = await Promise.all([
        getPlant(plantId), getPowerData(plantId, targetDate), getFuelData(plantId, targetDate),
        getPerfData(plantId, targetDate), getWaterData(plantId, targetDate), getAvailabilityData(plantId, targetDate),
        getSchedulingData(plantId, targetDate), getAshData(plantId, targetDate), getDsmData(plantId, targetDate),
        getOpsLog(plantId, targetDate),
    ]);

    const date = new Date(targetDate);

    // Compute live engine variables according to Excel DGR logic
    const genMu = Number(power?.generation_mu || 0);
    const coalMt = Number(fuel?.coal_cons_mt || 0);
    const ldoKl = Number(fuel?.ldo_cons_kl || 0);
    const hfoKl = Number(fuel?.hfo_cons_kl || 0);
    const gcvAf = Number(perf?.gcv_af || fuel?.coal_gcv_af || 0);

    // GHR = ((GCV_AF * Coal Cons) + ((LDO Cons + HFO Cons) * 10700)) / (Generation MU * 1000)
    const ghrDirect = genMu > 0 ? (((gcvAf * coalMt) + ((ldoKl + hfoKl) * 10700)) / (genMu * 1000)) : null;

    const apcMtd = await getMTDSum(plantId, targetDate, 'apc_mu');
    const apcYtd = await getYTDSum(plantId, targetDate, 'apc_mu');
    const genMtd = power?.generation_mtd || (await getMTDSum(plantId, targetDate, 'generation_mu'));
    const genYtd = power?.generation_ytd || (await getYTDSum(plantId, targetDate, 'generation_mu'));

    const formatHours = (hrs) => {
        if (hrs == null) return null;
        const mm = Math.round((hrs % 1) * 60);
        const h = Math.floor(hrs);
        const d = Math.floor(h / 24);
        const rem_h = h % 24;
        return d > 0 ? (d + 'D ' + rem_h + ':' + String(mm).padStart(2, '0')) : (rem_h + ':' + String(mm).padStart(2, '0'));
    };

    const getDcLossRemarks = () => {
        try {
            const reasons = (typeof scheduling?.dc_loss_reasons === 'string' ? JSON.parse(scheduling.dc_loss_reasons) : scheduling?.dc_loss_reasons) || [];
            return reasons.map(r => `${r.reason}: ${r.mu}MU`).join(', ');
        } catch (e) { return '' }
    };

    const formatLoss = (mu, pct) => mu != null ? `${mu} / ${pct ?? 0}%` : null;

    return {
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
                    { sn: "1.1", particulars: "Power Generation", uom: "MU", daily: power?.generation_mu, mtd: power?.generation_mtd, ytd: power?.generation_ytd },
                    { sn: "1.2", particulars: "Average Power Generation", uom: "MW", daily: power?.avg_load_mw, mtd: await getMTDAvg(plantId, targetDate, 'avg_load_mw'), ytd: await getYTDAvg(plantId, targetDate, 'avg_load_mw') },
                    { sn: "1.3", particulars: "Total Export (GT)", uom: "MU", daily: power?.export_mu, mtd: await getMTDSum(plantId, targetDate, 'export_mu'), ytd: await getYTDSum(plantId, targetDate, 'export_mu') },
                    { sn: "1.4", particulars: "Total Import (GT)", uom: "MU", daily: power?.import_mu, mtd: await getMTDSum(plantId, targetDate, 'import_mu'), ytd: await getYTDSum(plantId, targetDate, 'import_mu') },
                    { sn: "1.5", particulars: "Net Export (GT Export − GT Import)", uom: "MU", daily: (power?.export_mu != null && power?.import_mu != null) ? (power.export_mu - power.import_mu) : null, mtd: (await getMTDSum(plantId, targetDate, 'export_mu')) - (await getMTDSum(plantId, targetDate, 'import_mu')), ytd: (await getYTDSum(plantId, targetDate, 'export_mu')) - (await getYTDSum(plantId, targetDate, 'import_mu')) },
                    { sn: "1.6", particulars: "Auxiliary Power Consumption (APC incl Import)", uom: "MU", daily: power?.apc_mu, mtd: apcMtd, ytd: apcYtd },
                    { sn: "1.7", particulars: "APC %", uom: "%", daily: power?.apc_pct != null ? Number(power.apc_pct) * 100 : null, mtd: genMtd > 0 ? (apcMtd / genMtd) * 100 : 0, ytd: genYtd > 0 ? (apcYtd / genYtd) * 100 : 0 },
                    { sn: "1.8", particulars: "Hours on Grid", uom: "D(s) HH:MM", daily: formatHours(power?.hours_on_grid), mtd: null, ytd: null },
                    { sn: "1.9", particulars: "Grid Frequency", uom: "Hz", daily: power?.freq_avg, mtd: null, ytd: null }
                ]
            },
            {
                title: "2️⃣ PERFORMANCE",
                rows: [
                    { sn: "2.1", particulars: "Plant Load Factor", uom: "%", daily: power?.plf_daily != null ? Number(power.plf_daily) * 100 : null, mtd: power?.plf_mtd != null ? Number(power.plf_mtd) * 100 : null, ytd: power?.plf_ytd != null ? Number(power.plf_ytd) * 100 : null },
                    { sn: "2.2", particulars: "Partial Loading", uom: "%", daily: power?.plf_daily != null && Number(power.plf_daily) > 0 ? Math.max(0, 100 - Number(power.plf_daily) * 100) : null, mtd: power?.plf_mtd != null && Number(power.plf_mtd) > 0 ? Math.max(0, 100 - Number(power.plf_mtd) * 100) : null, ytd: power?.plf_ytd != null && Number(power.plf_ytd) > 0 ? Math.max(0, 100 - Number(power.plf_ytd) * 100) : null },
                    { sn: "2.3", particulars: "Plant Availability Factor (SEPC)", uom: "%", daily: availability?.paf_pct != null ? Number(availability.paf_pct) * 100 : null, mtd: availability?.paf_mtd != null ? Number(availability.paf_mtd) * 100 : null, ytd: availability?.paf_ytd != null ? Number(availability.paf_ytd) * 100 : null },
                    { sn: "2.4", particulars: "Plant Availability Factor (TNPDCL)", uom: "%", daily: availability?.paf_tnpdcl != null ? Number(availability.paf_tnpdcl) * 100 : null, mtd: null, ytd: null },
                    { sn: "2.5", particulars: "Plant Outage – Forced", uom: "Count", daily: power?.forced_outages, mtd: await getMTDSum(plantId, targetDate, 'forced_outages'), ytd: await getYTDSum(plantId, targetDate, 'forced_outages') },
                    { sn: "2.6", particulars: "Plant Outage – Planned", uom: "Count", daily: power?.planned_outages, mtd: await getMTDSum(plantId, targetDate, 'planned_outages'), ytd: await getYTDSum(plantId, targetDate, 'planned_outages') },
                    { sn: "2.7", particulars: "Plant Outage – RSD", uom: "Count", daily: power?.rsd_count, mtd: await getMTDSum(plantId, targetDate, 'rsd_count'), ytd: await getYTDSum(plantId, targetDate, 'rsd_count') },
                    { sn: "2.8", particulars: "Specific Oil Consumption", uom: "ml/kWh", daily: fuel?.soc_ml_kwh, mtd: await getMTDAvg(plantId, targetDate, 'soc_ml_kwh', 'daily_fuel'), ytd: await getYTDAvg(plantId, targetDate, 'soc_ml_kwh', 'daily_fuel') },
                    { sn: "2.9", particulars: "Specific Coal Consumption", uom: "kg/kWh", daily: fuel?.scc_kg_kwh, mtd: await getMTDAvg(plantId, targetDate, 'scc_kg_kwh', 'daily_fuel'), ytd: await getYTDAvg(plantId, targetDate, 'scc_kg_kwh', 'daily_fuel') },
                    { sn: "2.10", particulars: "GHR (As Fired)", uom: "kCal/kWh", daily: ghrDirect !== null ? ghrDirect.toFixed(2) : null, mtd: perf?.ghr_mtd, ytd: perf?.ghr_ytd },
                    { sn: "2.11", particulars: "GHR Remarks", uom: "Text", daily: perf?.ghr_remarks, mtd: null, ytd: null },
                    { sn: "2.12", particulars: "GCV (As Fired)", uom: "kCal/kg", daily: gcvAf, mtd: await getMTDAvg(plantId, targetDate, 'coal_gcv_af', 'daily_fuel'), ytd: await getYTDAvg(plantId, targetDate, 'coal_gcv_af', 'daily_fuel') },
                ]
            },
            {
                title: "3️⃣ CONSUMPTION & STOCK",
                rows: [
                    { sn: "3.1", particulars: "LDO Consumption", uom: "KL", daily: fuel?.ldo_cons_kl, mtd: await getMTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel') },
                    { sn: "3.2", particulars: "HFO Consumption", uom: "KL", daily: fuel?.hfo_cons_kl, mtd: await getMTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel') },
                    { sn: "3.3", particulars: "Coal Consumption", uom: "MT", daily: fuel?.coal_cons_mt, mtd: await getMTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel') },
                    { sn: "3.4", particulars: "LDO Receipt", uom: "KL", daily: fuel?.ldo_receipt_kl, mtd: await getMTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel') },
                    { sn: "3.5", particulars: "HFO Receipt", uom: "KL", daily: fuel?.hfo_receipt_kl, mtd: await getMTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel') },
                    { sn: "3.6", particulars: "Coal Receipt", uom: "MT", daily: fuel?.coal_receipt_mt, mtd: await getMTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel') },
                    { sn: "3.7", particulars: "LDO Total / Usable Stock", uom: "KL", daily: fuel?.ldo_stock_kl, mtd: null, ytd: null },
                    { sn: "3.8", particulars: "HFO Total / Usable Stock", uom: "KL", daily: fuel?.hfo_stock_kl, mtd: null, ytd: null },
                    { sn: "3.9", particulars: "Coal Stock", uom: "MT", daily: fuel?.coal_stock_mt, mtd: null, ytd: null },
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
                    { sn: "4.4", particulars: "Schedule Generation (SG – DAM)", uom: "MU", daily: scheduling?.sg_dam_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling') },
                    { sn: "4.5", particulars: "Schedule Generation (SG – RTM)", uom: "MU", daily: scheduling?.sg_rtm_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling') },
                    { sn: "4.6", particulars: "Total Schedule Generation", uom: "MU", daily: ((scheduling?.sg_ppa_mu || 0) + (scheduling?.sg_dam_mu || 0) + (scheduling?.sg_rtm_mu || 0)) || null, mtd: ((await getMTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling')) + (await getMTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')) + (await getMTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'))) || null, ytd: ((await getYTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling')) + (await getYTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling')) + (await getYTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'))) || null },
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
                    { sn: "5.2", particulars: "Fly Ash to Dyke / Internal", uom: "MT", daily: ash?.fa_to_dyke_mt, mtd: await getMTDSum(plantId, targetDate, 'fa_to_dyke_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'fa_to_dyke_mt', 'daily_ash') },
                    { sn: "5.3", particulars: "Bottom Ash to User", uom: "MT", daily: ash?.ba_to_user_mt, mtd: await getMTDSum(plantId, targetDate, 'ba_to_user_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'ba_to_user_mt', 'daily_ash') },
                    { sn: "5.4", particulars: "Bottom Ash to Dyke / Internal", uom: "MT", daily: ash?.ba_to_dyke_mt, mtd: await getMTDSum(plantId, targetDate, 'ba_to_dyke_mt', 'daily_ash'), ytd: await getYTDSum(plantId, targetDate, 'ba_to_dyke_mt', 'daily_ash') },
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
                    { sn: "6.4", particulars: "Specific Water Consumption", uom: "m³/MW", daily: genMu > 0 ? ((water?.dm_total_cons_m3 || 0) + (water?.service_water_m3 || 0) + (water?.potable_water_m3 || 0)) / genMu : null, mtd: null, ytd: null },
                    { sn: "6.5", particulars: "DM Water Generation", uom: "m³", daily: water?.dm_generation_m3, mtd: await getMTDSum(plantId, targetDate, 'dm_generation_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'dm_generation_m3', 'daily_water') },
                    { sn: "6.6", particulars: "Filtered / Service Water Generation", uom: "m³", daily: water?.filtered_water_gen_m3, mtd: await getMTDSum(plantId, targetDate, 'filtered_water_gen_m3', 'daily_water'), ytd: await getYTDSum(plantId, targetDate, 'filtered_water_gen_m3', 'daily_water') },
                    { sn: "6.7", particulars: "DM Water Total / Usable Stock", uom: "m³", daily: water?.dm_stock_m3, mtd: null, ytd: null },
                    { sn: "6.8", particulars: "Service Water Total / Usable Stock", uom: "m³", daily: water?.service_water_stock_m3, mtd: null, ytd: null }
                ]
            },
            {
                title: "7️⃣ DSM (Till Date)",
                rows: [
                    { sn: "7.1", particulars: "DSM Net Profit", uom: "Lacs", daily: dsm?.dsm_net_profit_lacs, mtd: await getMTDSum(plantId, targetDate, 'dsm_net_profit_lacs', 'daily_dsm'), ytd: await getYTDSum(plantId, targetDate, 'dsm_net_profit_lacs', 'daily_dsm') },
                    { sn: "7.2", particulars: "DSM Payable by SEPC", uom: "Lacs", daily: dsm?.dsm_payable_lacs, mtd: await getMTDSum(plantId, targetDate, 'dsm_payable_lacs', 'daily_dsm'), ytd: await getYTDSum(plantId, targetDate, 'dsm_payable_lacs', 'daily_dsm') },
                    { sn: "7.3", particulars: "DSM Receivable by SEPC", uom: "Lacs", daily: dsm?.dsm_receivable_lacs, mtd: await getMTDSum(plantId, targetDate, 'dsm_receivable_lacs', 'daily_dsm'), ytd: await getYTDSum(plantId, targetDate, 'dsm_receivable_lacs', 'daily_dsm') },
                    { sn: "7.4", particulars: "DSM Coal Saving / (+Loss) by SEPC", uom: "Lacs", daily: dsm?.dsm_coal_saving_lacs, mtd: await getMTDSum(plantId, targetDate, 'dsm_coal_saving_lacs', 'daily_dsm'), ytd: await getYTDSum(plantId, targetDate, 'dsm_coal_saving_lacs', 'daily_dsm') }
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
                    { sn: "9.1", particulars: "Coal Shortage", uom: "MU / %", daily: formatLoss(scheduling?.loss_coal_mu, scheduling?.loss_coal_pct), mtd: null, ytd: null },
                    { sn: "9.2", particulars: "CRE to SMPS Failure Trip", uom: "MU / %", daily: formatLoss(scheduling?.loss_cre_smps_mu, scheduling?.loss_cre_smps_pct), mtd: null, ytd: null },
                    { sn: "9.3", particulars: "Bunker Choke", uom: "MU / %", daily: formatLoss(scheduling?.loss_bunker_mu, scheduling?.loss_bunker_pct), mtd: null, ytd: null },
                    { sn: "9.4", particulars: "AOH", uom: "MU / %", daily: formatLoss(scheduling?.loss_aoh_mu, scheduling?.loss_aoh_pct), mtd: null, ytd: null },
                    { sn: "9.5", particulars: "Low Vacuum Trip", uom: "MU / %", daily: formatLoss(scheduling?.loss_vacuum_mu, scheduling?.loss_vacuum_pct), mtd: null, ytd: null }
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
}

// ── Data fetchers ──
async function getPlant(plantId) {
    const { rows } = await query(
        `SELECT *, 
            CASE 
              WHEN EXTRACT(MONTH FROM NOW()) >= fy_start_month 
              THEN EXTRACT(YEAR FROM NOW())::TEXT || '-' || (EXTRACT(YEAR FROM NOW())+1)::TEXT
              ELSE (EXTRACT(YEAR FROM NOW())-1)::TEXT || '-' || EXTRACT(YEAR FROM NOW())::TEXT
            END AS fy_label
     FROM plants WHERE id = $1`, [plantId]
    );
    return rows[0];
}
async function getPowerData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_power WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getFuelData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_fuel WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getPerfData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_performance WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getWaterData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_water WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getAshData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_ash WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getDsmData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_dsm WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getAvailabilityData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_availability WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getSchedulingData(plantId, date) {
    const { rows } = await query(`SELECT * FROM daily_scheduling WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getOpsLog(plantId, date) {
    const { rows } = await query(`SELECT * FROM operations_log WHERE plant_id=$1 AND entry_date=$2`, [plantId, date]);
    return rows[0];
}
async function getSubmissionStatus(plantId, date) {
    const { rows } = await query(
        `SELECT module, status, submitted_at, approved_at FROM submission_status
     WHERE plant_id=$1 AND entry_date=$2 ORDER BY module`, [plantId, date]
    );
    return rows;
}

// ── Aggregate helpers ──
async function getFYStartDate(plantId, date) {
    const { rows } = await query(`SELECT fy_start_month FROM plants WHERE id=$1`, [plantId]);
    const m = rows[0]?.fy_start_month || 4;
    const d = new Date(date);
    const y = (d.getMonth() + 1) >= m ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${String(m).padStart(2, '0')}-01`;
}

async function getMTDSum(plantId, date, col, table = 'daily_power') {
    const { rows } = await query(
        `SELECT SUM(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND DATE_TRUNC('month',entry_date)=DATE_TRUNC('month',$2::date)
       AND entry_date<=$2::date AND status IN ('submitted','approved','locked')`,
        [plantId, date]
    );
    return rows[0]?.val || 0;
}

async function getYTDSum(plantId, date, col, table = 'daily_power') {
    const fyStart = await getFYStartDate(plantId, date);
    const { rows } = await query(
        `SELECT SUM(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND entry_date>=$2::date AND entry_date<=$3::date
       AND status IN ('submitted','approved','locked')`,
        [plantId, fyStart, date]
    );
    return rows[0]?.val || 0;
}

async function getMTDAvg(plantId, date, col, table = 'daily_power') {
    const { rows } = await query(
        `SELECT AVG(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND DATE_TRUNC('month',entry_date)=DATE_TRUNC('month',$2::date)
       AND entry_date<=$2::date AND status IN ('submitted','approved','locked')`,
        [plantId, date]
    );
    return rows[0]?.val || 0;
}

async function getYTDAvg(plantId, date, col, table = 'daily_power') {
    const fyStart = await getFYStartDate(plantId, date);
    const { rows } = await query(
        `SELECT AVG(${col}) AS val FROM ${table}
     WHERE plant_id=$1 AND entry_date>=$2::date AND entry_date<=$3::date
       AND status IN ('submitted','approved','locked')`,
        [plantId, fyStart, date]
    );
    return rows[0]?.val || 0;
}

// ── Fleet summary for HQ dashboard ──
async function assembleFleetSummary(date) {
    const { rows: plants } = await query(
        `SELECT id, name, short_name, location, capacity_mw FROM plants WHERE status='active'`
    );

    const fleet = await Promise.all(plants.map(async (p) => {
        const power = await getPowerData(p.id, date);
        const fuel = await getFuelData(p.id, date);
        const status = await getSubmissionStatus(p.id, date);
        const submitted = status.filter(s => ['submitted', 'approved'].includes(s.status)).length;

        return {
            plantId: p.id,
            plantName: p.name,
            shortName: p.short_name,
            location: p.location,
            capacityMW: p.capacity_mw,
            generationMU: power?.generation_mu || 0,
            plfPct: power?.plf_daily || 0,
            apcPct: power?.apc_pct || 0,
            coalStockMT: fuel?.coal_stock_mt || 0,
            submittedModules: submitted,
            totalModules: 7,
            submissionStatus: status,
        };
    }));

    return {
        date,
        totalPlants: fleet.length,
        fullySubmitted: fleet.filter(p => p.submittedModules === p.totalModules).length,
        fleetGenerationMU: fleet.reduce((a, p) => a + p.generationMU, 0),
        fleet,
        generatedAt: new Date().toISOString(),
    };
}

module.exports = { assembleDGR, assembleFleetSummary };
