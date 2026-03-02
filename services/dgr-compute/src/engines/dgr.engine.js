// services/dgr-compute/src/engines/dgr.engine.js
// Replicates all Excel VLOOKUP + formula logic in pure JS + SQL
const { query } = require('../shared/db');

// ── Master DGR assembler — mirrors your Excel DGR sheet exactly ──
async function assembleDGR(plantId, targetDate) {
  const [
    plant,
    power,
    fuel,
    perf,
    water,
    availability,
    scheduling,
    opsLog,
  ] = await Promise.all([
    getPlant(plantId),
    getPowerData(plantId, targetDate),
    getFuelData(plantId, targetDate),
    getPerfData(plantId, targetDate),
    getWaterData(plantId, targetDate),
    getAvailabilityData(plantId, targetDate),
    getSchedulingData(plantId, targetDate),
    getOpsLog(plantId, targetDate),
  ]);

  const date = new Date(targetDate);

  // Compute live engine variables according to Excel DGR logic
  const genMu = Number(power?.generation_mu || 0);
  const coalMt = Number(fuel?.coal_cons_mt || 0);
  const ldoKl = Number(fuel?.ldo_cons_kl || 0);
  const hfoKl = Number(fuel?.hfo_cons_kl || 0);
  const gcvAf = Number(perf?.gcv_af || fuel?.coal_gcv_af || 0); // fallback to fuel row since we ingest GCV there

  // GHR = ((GCV_AF * Coal Cons) + ((LDO Cons + HFO Cons) * 10700)) / (Generation MU * 1000)
  const ghrDirect = genMu > 0 ? (((gcvAf * coalMt) + ((ldoKl + hfoKl) * 10700)) / (genMu * 1000)) : null;

  return {
    // ── Header ──
    header: {
      title: `DAILY GENERATION REPORT — ${plant.fy_label}`,
      company: plant.company_name,
      plantName: plant.name,
      documentNumber: plant.document_number,
      date: targetDate,
      dayName: date.toLocaleDateString('en-IN', { weekday: 'long' }),
      monthYear: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      fyLabel: plant.fy_label,
    },

    // ── Section 1: Power (mirrors DGR rows 7–15) ──
    power: {
      generation: {
        label: 'Power Generation',
        uom: 'MU',
        daily: power?.generation_mu,
        mtd: power?.generation_mtd,
        ytd: power?.generation_ytd,
      },
      avgLoad: {
        label: 'Average Power Generation',
        uom: 'MW',
        daily: power?.avg_load_mw,
        mtd: await getMTDAvg(plantId, targetDate, 'avg_load_mw'),
        ytd: await getYTDAvg(plantId, targetDate, 'avg_load_mw'),
      },
      exportGT: {
        label: 'Total Export (GT)',
        uom: 'MU',
        daily: power?.export_mu,
        mtd: await getMTDSum(plantId, targetDate, 'export_mu'),
        ytd: await getYTDSum(plantId, targetDate, 'export_mu'),
      },
      importGT: {
        label: 'Total Import (GT)',
        uom: 'MU',
        daily: power?.import_mu,
        mtd: await getMTDSum(plantId, targetDate, 'import_mu'),
        ytd: await getYTDSum(plantId, targetDate, 'import_mu'),
      },
      apc: {
        label: 'Auxiliary Power Consumption (APC incl Import)',
        uom: 'MU',
        daily: power?.apc_mu,
        mtd: await getMTDSum(plantId, targetDate, 'apc_mu'),
        ytd: await getYTDSum(plantId, targetDate, 'apc_mu'),
        pct: {
          daily: power?.apc_pct,
          mtd: await getMTDAvg(plantId, targetDate, 'apc_pct'),
          ytd: await getYTDAvg(plantId, targetDate, 'apc_pct'),
        },
      },
      hoursOnGrid: {
        label: 'Hours on Grid',
        uom: 'HH:MM',
        daily: power?.hours_on_grid,
      },
      gridFrequency: {
        label: 'Grid Frequency',
        uom: 'Hz',
        min: power?.freq_min,
        max: power?.freq_max,
        avg: power?.freq_avg,
      },
    },

    // ── Section 2: Performance (mirrors DGR rows 17–28) ──
    performance: {
      plf: {
        label: 'Plant Load Factor',
        uom: '%',
        daily: power?.plf_daily,
        mtd: power?.plf_mtd,
        ytd: power?.plf_ytd,
      },
      paf: {
        label: 'Plant Availability Factor (SEPC)',
        uom: '%',
        daily: availability?.paf_pct,
        mtd: availability?.paf_mtd,
        ytd: availability?.paf_ytd,
      },
      outages: {
        forced: { daily: power?.forced_outages, mtd: await getMTDSum(plantId, targetDate, 'forced_outages', 'daily_power'), ytd: await getYTDSum(plantId, targetDate, 'forced_outages', 'daily_power') },
        planned: { daily: power?.planned_outages, mtd: await getMTDSum(plantId, targetDate, 'planned_outages', 'daily_power'), ytd: await getYTDSum(plantId, targetDate, 'planned_outages', 'daily_power') },
        rsd: { daily: power?.rsd_count, mtd: await getMTDSum(plantId, targetDate, 'rsd_count', 'daily_power'), ytd: await getYTDSum(plantId, targetDate, 'rsd_count', 'daily_power') },
      },
      soc: {
        label: 'Specific Oil Consumption',
        uom: 'ml/kWh',
        daily: fuel?.soc_ml_kwh,
        mtd: await getMTDAvg(plantId, targetDate, 'soc_ml_kwh', 'daily_fuel'),
        ytd: await getYTDAvg(plantId, targetDate, 'soc_ml_kwh', 'daily_fuel'),
      },
      scc: {
        label: 'Specific Coal Consumption',
        uom: 'kg/kWh',
        daily: fuel?.scc_kg_kwh,
        mtd: await getMTDAvg(plantId, targetDate, 'scc_kg_kwh', 'daily_fuel'),
        ytd: await getYTDAvg(plantId, targetDate, 'scc_kg_kwh', 'daily_fuel'),
      },
      ghr: {
        label: 'Gross Heat Rate (As Fired)',
        uom: 'kCal/kWh',
        daily: ghrDirect !== null ? ghrDirect.toFixed(2) : null,
        mtd: perf?.ghr_mtd,
        ytd: perf?.ghr_ytd,
      },
      gcv: {
        label: 'GCV (As Fired)',
        uom: 'kCal/kg',
        daily: gcvAf,
        mtd: await getMTDAvg(plantId, targetDate, 'coal_gcv_af', 'daily_fuel'),
        ytd: await getYTDAvg(plantId, targetDate, 'coal_gcv_af', 'daily_fuel'),
      },
    },

    // ── Section 3: Consumption & Stock (mirrors DGR rows 29–50) ──
    consumptionStock: {
      ldoConsumption: {
        label: 'LDO Consumption', uom: 'KL',
        daily: fuel?.ldo_cons_kl,
        mtd: await getMTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel'),
        ytd: await getYTDSum(plantId, targetDate, 'ldo_cons_kl', 'daily_fuel'),
        rate: fuel?.ldo_rate,
      },
      hfoConsumption: {
        label: 'HFO Consumption', uom: 'KL',
        daily: fuel?.hfo_cons_kl,
        mtd: await getMTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel'),
        ytd: await getYTDSum(plantId, targetDate, 'hfo_cons_kl', 'daily_fuel'),
        rate: fuel?.hfo_rate,
      },
      coalConsumption: {
        label: 'Coal Consumption', uom: 'MT',
        daily: fuel?.coal_cons_mt,
        mtd: await getMTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel'),
        ytd: await getYTDSum(plantId, targetDate, 'coal_cons_mt', 'daily_fuel'),
      },
      ldoReceipt: { label: 'LDO Receipt', uom: 'KL', daily: fuel?.ldo_receipt_kl, mtd: await getMTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'ldo_receipt_kl', 'daily_fuel') },
      hfoReceipt: { label: 'HFO Receipt', uom: 'KL', daily: fuel?.hfo_receipt_kl, mtd: await getMTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'hfo_receipt_kl', 'daily_fuel') },
      coalReceipt: { label: 'Coal Receipt', uom: 'MT', daily: fuel?.coal_receipt_mt, mtd: await getMTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel'), ytd: await getYTDSum(plantId, targetDate, 'coal_receipt_mt', 'daily_fuel') },
      ldoStock: { label: 'LDO Stock', uom: 'KL', daily: fuel?.ldo_stock_kl },
      hfoStock: { label: 'HFO Stock', uom: 'KL', daily: fuel?.hfo_stock_kl },
      coalStock: { label: 'Coal Stock', uom: 'MT', daily: fuel?.coal_stock_mt },
      dmWater: { label: 'DM Water Consumption (Cycle Makeup)', uom: 'm3', daily: water?.dm_cycle_makeup_m3, pct: water?.dm_cycle_pct },
      dmWaterTotal: { label: 'Total DM Water Consumption', uom: 'm3', daily: water?.dm_total_cons_m3 },
      serviceWater: { label: 'Service Water Consumption', uom: 'm3', daily: water?.service_water_m3 },
      potableWater: { label: 'Potable Water Consumption', uom: 'm3', daily: water?.potable_water_m3 },
      seaWater: { label: 'Sea Water Consumption', uom: 'm3', daily: water?.sea_water_m3 },
      h2: { label: 'H₂ Consumption', uom: 'Nos', daily: fuel?.h2_cons, stock: fuel?.h2_stock },
      co2: { label: 'CO₂ Consumption', uom: 'Nos', daily: fuel?.co2_cons, stock: fuel?.co2_stock },
      n2: { label: 'N₂ Consumption', uom: 'Nos', daily: fuel?.n2_cons, stock: fuel?.n2_stock },
    },

    // ── Section 4: Power Schedule (mirrors DGR rows 51–65) ──
    scheduling: {
      dcSEPC: { label: 'Declared Capacity (SEPC)', uom: 'MU', daily: scheduling?.dc_sepc_mu, mtd: await getMTDSum(plantId, targetDate, 'dc_sepc_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'dc_sepc_mu', 'daily_scheduling') },
      dcTNPDCL: { label: 'Declared Capacity (TNPDCL)', uom: 'MU', daily: scheduling?.dc_tnpdcl_mu, mtd: await getMTDSum(plantId, targetDate, 'dc_tnpdcl_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'dc_tnpdcl_mu', 'daily_scheduling') },
      sgPPA: { label: 'Schedule Generation (SG-PPA)', uom: 'MU', daily: scheduling?.sg_ppa_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_ppa_mu', 'daily_scheduling') },
      sgDAM: { label: 'Schedule Generation (SG-DAM)', uom: 'MU', daily: scheduling?.sg_dam_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_dam_mu', 'daily_scheduling') },
      sgRTM: { label: 'Schedule Generation (SG-RTM)', uom: 'MU', daily: scheduling?.sg_rtm_mu, mtd: await getMTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling'), ytd: await getYTDSum(plantId, targetDate, 'sg_rtm_mu', 'daily_scheduling') },
      ursDAM: { label: 'URS @ RTM (DAM)', uom: 'MWH', daily: scheduling?.urs_dam_mwh },
      ursRTM: { label: 'URS @ RTM (RTM)', uom: 'MWH', daily: scheduling?.urs_rtm_mwh },
    },

    // ── Operations ──
    operations: opsLog,

    // ── Metadata ──
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
