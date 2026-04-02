// src/utils/moduleExcel.js
// Per-module Excel field definitions + download/parse helpers
import * as XLSX from 'xlsx'

// ── Field definitions ──────────────────────────────────────────────────────────
// Each field: { key, label, unit, type }
// type: 'number' (default) | 'text'

export const FUEL_FIELDS = [
  // Coal
  { key: 'coalReceiptMt',  label: 'Coal Receipt',        unit: 'MT' },
  { key: 'coalConsMt',     label: 'Coal Consumption',    unit: 'MT' },
  { key: 'coalStockMt',    label: 'Coal Stock',          unit: 'MT' },
  { key: 'coalGcvAr',      label: 'GCV (As Received)',   unit: 'kCal/kg' },
  { key: 'coalGcvAf',      label: 'GCV (As Fired)',      unit: 'kCal/kg' },
  // LDO
  { key: 'ldoReceiptKl',   label: 'LDO Receipt',         unit: 'KL' },
  { key: 'ldoConsKl',      label: 'LDO Consumption',     unit: 'KL' },
  { key: 'ldoStockKl',     label: 'LDO Stock',           unit: 'KL' },
  { key: 'ldoRate',        label: 'LDO Rate',            unit: '₹/KL' },
  // HFO
  { key: 'hfoReceiptKl',   label: 'HFO Receipt',         unit: 'KL' },
  { key: 'hfoConsKl',      label: 'HFO Consumption',     unit: 'KL' },
  { key: 'hfoStockKl',     label: 'HFO Stock',           unit: 'KL' },
  { key: 'hfoRate',        label: 'HFO Rate',            unit: '₹/KL' },
  // Gas cylinders
  { key: 'h2Receipt',      label: 'H2 Receipt',          unit: 'Nos' },
  { key: 'h2Cons',         label: 'H2 Consumed',         unit: 'Nos' },
  { key: 'h2Stock',        label: 'H2 Stock',            unit: 'Nos' },
  { key: 'co2Receipt',     label: 'CO2 Receipt',         unit: 'Nos' },
  { key: 'co2Cons',        label: 'CO2 Consumed',        unit: 'Nos' },
  { key: 'co2Stock',       label: 'CO2 Stock',           unit: 'Nos' },
  { key: 'n2Receipt',      label: 'N2 Receipt',          unit: 'Nos' },
  { key: 'n2Cons',         label: 'N2 Consumed',         unit: 'Nos' },
  { key: 'n2Stock',        label: 'N2 Stock',            unit: 'Nos' },
]

export const WATER_FIELDS = [
  { key: 'dmGenerationM3',      label: 'DM Water Generation',       unit: 'm³' },
  { key: 'dmCycleMakeupM3',     label: 'DM Cycle Makeup',           unit: 'm³' },
  { key: 'dmTotalConsM3',       label: 'DM Total Consumption',      unit: 'm³' },
  { key: 'dmStockM3',           label: 'DM Stock',                  unit: 'm³' },
  { key: 'filteredWaterGenM3',  label: 'Filtered Water Generation', unit: 'm³' },
  { key: 'serviceWaterM3',      label: 'Service Water Consumption', unit: 'm³' },
  { key: 'serviceWaterStockM3', label: 'Service Water Stock',       unit: 'm³' },
  { key: 'idctMakeupM3',        label: 'CT Makeup Sea Water',       unit: 'm³' },
  { key: 'outfallM3',           label: 'Outfall',                   unit: 'm³' },
  { key: 'seaWaterM3',          label: 'Sea Water Intake',          unit: 'm³' },
  { key: 'swiFlowM3',           label: 'SWI Flow',                  unit: 'm³' },
  { key: 'potableWaterM3',      label: 'Potable Water',             unit: 'm³' },
]

export const PERFORMANCE_FIELDS = [
  { key: 'ghrDirect',   label: 'GHR Direct',          unit: 'kCal/kWh' },
  { key: 'gcvAr',       label: 'GCV (As Received)',    unit: 'kCal/kg' },
  { key: 'gcvAf',       label: 'GCV (As Fired)',       unit: 'kCal/kg' },
  { key: 'loiBa',       label: 'LOI Bottom Ash',       unit: '%' },
  { key: 'loiFa',       label: 'LOI Fly Ash',          unit: '%' },
  { key: 'fcPct',       label: 'Fixed Carbon %',       unit: '%' },
  { key: 'vmPct',       label: 'Volatile Matter %',    unit: '%' },
  { key: 'fcVmRatio',   label: 'FC/VM Ratio',          unit: '' },
  { key: 'millSieveA',  label: 'Mill Sieve A',         unit: '%' },
  { key: 'millSieveB',  label: 'Mill Sieve B',         unit: '%' },
  { key: 'millSieveC',  label: 'Mill Sieve C',         unit: '%' },
  { key: 'ghrRemarks',  label: 'GHR Remarks',          unit: '', type: 'text' },
]

export const SCHEDULING_FIELDS = [
  { key: 'dcSepcMu',          label: 'DC SEPC',                unit: 'MU' },
  { key: 'dcTnpdclMu',        label: 'DC TNPDCL',              unit: 'MU' },
  { key: 'sgPpaMu',           label: 'SG PPA',                 unit: 'MU' },
  { key: 'sgDamMu',           label: 'SG DAM',                 unit: 'MU' },
  { key: 'sgRtmMu',           label: 'SG RTM',                 unit: 'MU' },
  { key: 'ursDamMwh',         label: 'URS DAM',                unit: 'MWh' },
  { key: 'ursRtmMwh',         label: 'URS RTM',                unit: 'MWh' },
  { key: 'ursRevenue',        label: 'URS Revenue',            unit: '₹' },
  { key: 'ursNetProfitLacs',  label: 'URS Net Profit',         unit: 'Lacs' },
  { key: 'askingRateMw',      label: 'Asking Rate',            unit: 'MW' },
  { key: 'deemedGenMu',       label: 'Deemed Generation',      unit: 'MU' },
  { key: 'lossCoalMu',        label: 'Loss - Coal',            unit: 'MU' },
  { key: 'lossCreSmpsMu',     label: 'Loss - CRE/SMPS',       unit: 'MU' },
  { key: 'lossBunkerMu',      label: 'Loss - Bunker',          unit: 'MU' },
  { key: 'lossAohMu',         label: 'Loss - AOH',             unit: 'MU' },
  { key: 'lossVacuumMu',      label: 'Loss - Vacuum',          unit: 'MU' },
  { key: 'remarks',           label: 'Remarks',                unit: '', type: 'text' },
]

export const AVAILABILITY_FIELDS = [
  { key: 'pafPct',           label: 'PAF %',              unit: '%' },
  { key: 'pafTnpdclPct',     label: 'PAF TNPDCL %',       unit: '%' },
  { key: 'onBarHours',       label: 'On-Bar Hours',        unit: 'hrs' },
  { key: 'rsdHours',         label: 'RSD Hours',           unit: 'hrs' },
  { key: 'forcedOutageHrs',  label: 'Forced Outage Hrs',  unit: 'hrs' },
  { key: 'plannedOutageHrs', label: 'Planned Outage Hrs', unit: 'hrs' },
]

export const ASH_FIELDS = [
  { key: 'fa_generated_mt', label: 'Fly Ash Generated',           unit: 'MT' },
  { key: 'fa_to_user_mt',   label: 'Fly Ash to User',             unit: 'MT' },
  { key: 'fa_to_dyke_mt',   label: 'Fly Ash to Dyke / Internal',  unit: 'MT' },
  { key: 'fa_silo_mt',      label: 'Fly Ash Silo',                unit: 'MT' },
  { key: 'ba_generated_mt', label: 'Bottom Ash Generated',        unit: 'MT' },
  { key: 'ba_to_user_mt',   label: 'Bottom Ash to User',          unit: 'MT' },
  { key: 'ba_to_dyke_mt',   label: 'Bottom Ash to Dyke',          unit: 'MT' },
  { key: 'ba_silo_mt',      label: 'Bottom Ash Silo',             unit: 'MT' },
]

export const DSM_FIELDS = [
  { key: 'dsm_net_profit_lacs',    label: 'DSM Net Profit',   unit: '₹ Lacs' },
  { key: 'dsm_payable_lacs',       label: 'DSM Payable',      unit: '₹ Lacs' },
  { key: 'dsm_receivable_lacs',    label: 'DSM Receivable',   unit: '₹ Lacs' },
  { key: 'dsm_coal_saving_lacs',   label: 'DSM Coal Saving',  unit: '₹ Lacs' },
]

export const OPERATIONS_FIELDS = [
  { key: 'boilerActivities',      label: 'Boiler & Auxiliary Activities',     unit: '', type: 'text' },
  { key: 'turbineActivities',     label: 'Turbine & Auxiliary Activities',    unit: '', type: 'text' },
  { key: 'electricalActivities',  label: 'Electrical & Instrumentation',     unit: '', type: 'text' },
  { key: 'bopActivities',         label: 'Balance of Plant (BOP)',            unit: '', type: 'text' },
  { key: 'runningEquipment',      label: 'Running Equipment Status',          unit: '', type: 'text' },
  { key: 'outageDetails',         label: 'Outage / Grid Disturbance Details', unit: '', type: 'text' },
  { key: 'remarks',               label: 'Remarks (DGR Section 10.2)',        unit: '', type: 'text' },
  { key: 'observations',          label: 'Observations (DGR Section 10.3)',   unit: '', type: 'text' },
]

// Power fields are built dynamically from meters + extras
export const POWER_EXTRA_FIELDS = [
  { key: 'freqMin',          label: 'Grid Freq Min',        unit: 'Hz' },
  { key: 'freqMax',          label: 'Grid Freq Max',        unit: 'Hz' },
  { key: 'freqAvg',          label: 'Grid Freq Avg',        unit: 'Hz' },
  { key: 'hoursOnGrid',      label: 'Hours on Grid',        unit: 'hrs' },
  { key: 'forcedOutages',    label: 'Forced Outages',       unit: 'Nos' },
  { key: 'plannedOutages',   label: 'Planned Outages',      unit: 'Nos' },
  { key: 'rsdCount',         label: 'RSD Count',            unit: 'Nos' },
  { key: 'partialLoadingPct',label: 'Partial Loading %',    unit: '%' },
  { key: 'outageRemarks',    label: 'Outage Remarks',       unit: '', type: 'text' },
]

// ── Download Template ──────────────────────────────────────────────────────────
// Creates a 2-column Excel: Col A = "Label (unit)", Col B = value (or blank)
export function downloadTemplate(fields, currentData = {}, filename = 'template.xlsx', entryDate = '') {
  const wb = XLSX.utils.book_new()

  // Row 0: info
  const rows = [
    ['DGR Portal Data Entry Template', '', ''],
    [`Date: ${entryDate || '(fill in date)'}`, '', ''],
    ['', '', ''],
    ['Field', 'Unit', 'Value'],  // header row (idx 3)
  ]

  for (const f of fields) {
    const val = currentData[f.key] ?? ''
    rows.push([f.label, f.unit || '', val === null ? '' : val])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 18 }]

  // Style header row (row index 3)
  // SheetJS CE doesn't support styles but we can mark the range
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 2 } })

  XLSX.utils.book_append_sheet(wb, ws, 'Data Entry')
  XLSX.writeFile(wb, filename)
}

// ── Parse Uploaded Excel ───────────────────────────────────────────────────────
// Reads the file, finds the header row (row with "Field" in col A),
// then maps each subsequent row: label → key → value
export async function parseExcel(file, fields) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Build label → field map
        const labelMap = {}
        for (const f of fields) {
          labelMap[f.label.toLowerCase().trim()] = f
        }

        // Find header row (where col A == 'Field')
        let dataStart = -1
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0]).trim().toLowerCase() === 'field') {
            dataStart = i + 1
            break
          }
        }
        if (dataStart === -1) {
          reject(new Error('Could not find header row. Make sure you use the downloaded template.'))
          return
        }

        const result = {}
        for (let i = dataStart; i < rows.length; i++) {
          const label = String(rows[i][0]).trim().toLowerCase()
          const rawVal = rows[i][2]  // col C = Value
          const field = labelMap[label]
          if (!field) continue
          if (rawVal === '' || rawVal == null) continue
          result[field.key] = field.type === 'text' ? String(rawVal) : Number(rawVal)
        }

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
