// src/pages/data-entry/PowerEntry.jsx
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry, plants as plantsApi } from '../../api'

const today = new Date().toISOString().split('T')[0]

function fmt(val, dec = 3) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return parseFloat(val).toFixed(dec)
}

// Exact meter codes — matches backend power.controller.js
const GEN_CODES = ['GEN_MAIN']
const EXPORT_CODES = ['GT_EXP_MAIN']
const IMPORT_CODES = ['GT_IMP_MAIN']  // GT only — matches Excel DGR formula

function computeLive(meters, readings, prevReadings, plantCapacity = 525, hoursOnGrid = 24) {
  const meterMap = {}
  for (const m of meters) meterMap[m.meter_code] = parseFloat(m.multiplier)

  function calcDelta(codes) {
    let total = 0
    for (const code of codes) {
      if (!meterMap[code]) continue
      const cur = parseFloat(readings[code] || 0)
      const prev = parseFloat(prevReadings[code] || 0)
      if (cur > 0 && prev > 0 && cur >= prev) total += (cur - prev) * meterMap[code]
    }
    return total
  }

  const generationMU = calcDelta(GEN_CODES)
  const exportMU = calcDelta(EXPORT_CODES)
  const importMU = calcDelta(IMPORT_CODES)
  const apcMU = generationMU - exportMU + importMU
  const apcPct = generationMU > 0 ? (apcMU / generationMU) * 100 : 0
  const hrs = parseFloat(hoursOnGrid) || 24
  const avgLoadMW = (generationMU * 1000) / hrs
  const plfDaily = (avgLoadMW / parseFloat(plantCapacity)) * 100

  return { generationMU, exportMU, importMU, apcMU, apcPct, avgLoadMW, plfDaily }
}

// Format decimal hours → "X Day(s), Y Hrs, Z Mins"  (matches Excel DGR row 1.5)
function fmtHours(h) {
  h = parseFloat(h) || 0
  const days = Math.floor(h / 24)
  const hrs = Math.floor(h % 24)
  const mins = Math.round((h - Math.floor(h)) * 60)
  return days > 0 ? `${days} Day(s), ${hrs} Hrs, ${mins} Mins` : `${hrs} Hrs, ${mins} Mins`
}

export default function PowerEntry() {
  const { selectedPlant } = usePlant()
  const qc = useQueryClient()
  const plantId = selectedPlant?.id

  const [date, setDate] = useState(today)
  const [readings, setReadings] = useState({})
  const [extras, setExtras] = useState({
    freqMin: '', freqMax: '', freqAvg: '',
    hoursOnGrid: 24, forcedOutages: 0, plannedOutages: 0,
    rsdCount: 0, outageRemarks: '', partialLoadingPct: '',
  })
  const [savedComputed, setSavedComputed] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saveErr, setSaveErr] = useState(null)

  const { data: plantsData } = useQuery({
    queryKey: ['plant-meters', plantId],
    queryFn: () => plantsApi.meters(plantId),
    enabled: !!plantId,
  })
  const meters = plantsData?.data?.data?.meters || []

  const { data: existingData } = useQuery({
    queryKey: ['power-entry', plantId, date],
    queryFn: () => dataEntry.getPower(plantId, date),
    enabled: !!plantId && !!date,
    retry: false,
  })

  const prevDate = useMemo(() => {
    const d = new Date(date); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [date])

  const { data: prevData } = useQuery({
    queryKey: ['power-entry', plantId, prevDate],
    queryFn: () => dataEntry.getPower(plantId, prevDate),
    enabled: !!plantId && !!prevDate,
    retry: false,
  })
  const prevReadings = prevData?.data?.data?.meter_readings || {}

  useEffect(() => {
    const entry = existingData?.data?.data
    if (entry?.meter_readings) {
      setReadings(entry.meter_readings)
      setExtras({
        freqMin: entry.freq_min ?? '',
        freqMax: entry.freq_max ?? '',
        freqAvg: entry.freq_avg ?? '',
        hoursOnGrid: entry.hours_on_grid ?? 24,
        forcedOutages: entry.forced_outages ?? 0,
        plannedOutages: entry.planned_outages ?? 0,
        rsdCount: entry.rsd_count ?? 0,
        outageRemarks: entry.outage_remarks ?? '',
        partialLoadingPct: entry.partial_loading_pct ?? '',
      })
      setSavedComputed({
        generationMU: entry.generation_mu,
        exportMU: entry.export_mu,
        importMU: entry.import_mu,
        apcMU: entry.apc_mu,
        apcPct: (entry.apc_pct || 0) * 100,
        avgLoadMW: entry.avg_load_mw,
        plfDaily: (entry.plf_daily || 0) * 100,
        generationMTD: entry.generation_mtd,
        generationYTD: entry.generation_ytd,
        plfMTD: entry.plf_mtd ? entry.plf_mtd * 100 : null,
        plfYTD: entry.plf_ytd ? entry.plf_ytd * 100 : null,
      })
    } else {
      setReadings({}); setSavedComputed(null)
    }
  }, [existingData])

  const liveComputed = useMemo(() => {
    if (!meters.length) return null
    if (!Object.values(readings).some(v => v && parseFloat(v) > 0)) return null
    return computeLive(meters, readings, prevReadings, selectedPlant?.plf_base_mw || 492.1875, extras.hoursOnGrid)
  }, [meters, readings, prevReadings, extras.hoursOnGrid, selectedPlant])

  const saveMutation = useMutation({
    mutationFn: (data) => dataEntry.savePower(data),
    onSuccess: (res) => {
      const c = res.data?.data?.computed
      if (c) {
        setSavedComputed({
          generationMU: c.generationMU,
          exportMU: c.exportMU,
          importMU: c.importMU,
          apcMU: c.apcMU,
          apcPct: (c.apcPct || 0) * 100,
          avgLoadMW: c.avgLoadMW,
          plfDaily: (c.plfDaily || 0) * 100,
          generationMTD: c.generationMTD,
          generationYTD: c.generationYTD,
          plfMTD: c.plfMTD ? c.plfMTD * 100 : null,
          plfYTD: c.plfYTD ? c.plfYTD * 100 : null,
        })
      }
      setSaveErr(null)
      setMsg({ type: 'success', text: '✓ Power entry saved successfully' })
      qc.invalidateQueries(['power-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId])
      setTimeout(() => setMsg(null), 4000)
    },
    onError: (err) => {
      const m = err.response?.data?.message || err.message || 'Save failed'
      const s = err.response?.status
      setSaveErr({ status: s, message: m })
      setMsg({ type: 'error', text: `✗ ${m}` })
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => dataEntry.submitPower({ plantId, entryDate: date }),
    onSuccess: () => {
      setMsg({ type: 'success', text: '✓ Submitted for approval' })
      qc.invalidateQueries(['power-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId])
    },
    onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Submit failed' }),
  })

  const handleSave = () => {
    if (!plantId) return
    setSaveErr(null)
    saveMutation.mutate({
      plantId, entryDate: date,
      meterReadings: readings,
      freqMin: extras.freqMin || null,
      freqMax: extras.freqMax || null,
      freqAvg: extras.freqAvg || null,
      hoursOnGrid: extras.hoursOnGrid,
      forcedOutages: extras.forcedOutages,
      plannedOutages: extras.plannedOutages,
      rsdCount: extras.rsdCount,
      outageRemarks: extras.outageRemarks,
      partialLoadingPct: extras.partialLoadingPct,
      entryMethod: 'manual',
    })
  }

  const status = existingData?.data?.data?.status
  const isLocked = status === 'locked' || status === 'approved'
  const hasPrev = Object.keys(prevReadings).length > 0
  const display = savedComputed || liveComputed

  return (
    <div>
      <div className="page-title">⚡ Power Generation Entry</div>
      <div className="page-sub">Enter cumulative meter readings — all KPIs auto-computed</div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {saveErr && (
        <div className="alert alert-error" style={{ fontSize: 12 }}>
          <b>Backend Error {saveErr.status && `[${saveErr.status}]`}:</b> {saveErr.message}
          <br />
          <span style={{ opacity: 0.7 }}>
            Make sure <code>data-entry</code> service is running on port 3003.
            Run: <code>cd dgr-platform && npm run dev:data-entry</code>
          </span>
        </div>
      )}

      {/* Date row */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Entry Date</label>
              <input className="form-input" type="date" value={date} max={today}
                onChange={e => { setDate(e.target.value); setSavedComputed(null) }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: hasPrev ? 'var(--green)' : '#f59e0b' }}>
              {hasPrev ? '✓ Prev day readings found — live preview active' : '⚠ No prev day data found'}
            </div>
            <div style={{ flex: 1 }} />
            {status && (
              <div>
                <div className="form-label">Status</div>
                <span className={`tag ${status === 'approved' ? 'tag-done' : status === 'submitted' ? 'tag-pend' : 'tag-draft'}`}>
                  {status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {!plantId ? (
        <div className="alert alert-info">ℹ Select a plant from the sidebar to begin entry.</div>
      ) : (
        <>
          {/* Meter Readings */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr">
              <div className="card-title">📟 TANGEDCO Meter Readings</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter today's cumulative readings</div>
            </div>
            <div className="card-body">
              {meters.length === 0 ? (
                <div className="alert alert-warn">⚠ No meters configured.</div>
              ) : (
                <div className="form-grid-3">
                  {meters.map(m => {
                    const prev = prevReadings[m.meter_code]
                    const cur = parseFloat(readings[m.meter_code])
                    const delta = (cur && prev) ? (cur - prev) * parseFloat(m.multiplier) : null
                    const isNeg = delta !== null && delta < 0
                    return (
                      <div className="form-group" key={m.meter_code}>
                        <label className="form-label">
                          {m.meter_name}
                          <span className="unit">MF×{m.multiplier}</span>
                        </label>
                        <input
                          className="form-input mono"
                          type="number" step="0.001" placeholder="0.000"
                          value={readings[m.meter_code] || ''}
                          disabled={isLocked}
                          style={isNeg ? { borderColor: '#ef4444' } : {}}
                          onChange={e => setReadings(r => ({ ...r, [m.meter_code]: e.target.value }))}
                        />
                        <div style={{ fontSize: 11, marginTop: 3, display: 'flex', gap: 8 }}>
                          {prev && <span style={{ color: 'var(--muted)' }}>Prev: {prev}</span>}
                          {delta !== null && !isNeg && (
                            <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{delta.toFixed(4)} MU</span>
                          )}
                          {isNeg && <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ Negative!</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Live / Saved Computed Panel */}
          {display && (
            <div className="card" style={{
              marginBottom: 20,
              border: `2px solid ${savedComputed ? '#16a34a' : '#2563eb'}`,
            }}>
              <div className="card-hdr" style={{ background: savedComputed ? '#dcfce7' : '#dbeafe' }}>
                <div className="card-title" style={{ color: savedComputed ? '#16a34a' : '#2563eb' }}>
                  {savedComputed ? '✅ Saved & Computed (Server)' : '⚡ Live Preview (Client-side estimate)'}
                </div>
                <div style={{ fontSize: 12, color: savedComputed ? '#16a34a' : '#2563eb' }}>
                  {savedComputed ? 'Includes accurate MTD & YTD from database' : 'Save to get MTD / YTD'}
                </div>
              </div>
              <div className="card-body">
                <div className="form-grid-3">
                  {[
                    ['⚡ Generation', fmt(display.generationMU), 'MU'],
                    ['📤 Export GT', fmt(display.exportMU), 'MU'],
                    ['📥 Import GT', fmt(display.importMU), 'MU'],
                    ['🔌 APC', fmt(display.apcMU), 'MU'],
                    ['📊 APC %', fmt(display.apcPct, 2), '%'],
                    ['⚖ Avg Load', fmt(display.avgLoadMW, 2), 'MW'],
                    ['📈 PLF Daily', fmt(display.plfDaily, 2), '%'],
                    ...(savedComputed ? [
                      ['📅 Gen MTD', fmt(savedComputed.generationMTD), 'MU'],
                      ['📆 Gen YTD', fmt(savedComputed.generationYTD), 'MU'],
                      ['📅 PLF MTD', fmt(savedComputed.plfMTD, 2), '%'],
                      ['📆 PLF YTD', fmt(savedComputed.plfYTD, 2), '%'],
                    ] : []),
                  ].map(([label, val, unit]) => (
                    <div key={label} style={{
                      background: '#fff', borderRadius: 10, padding: '12px 16px',
                      border: '1px solid rgba(0,0,0,0.07)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {val} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>{unit}</span>
                      </div>
                    </div>
                  ))}

                  {/* DGR Row 1.5 — Hours on Grid */}
                  <div style={{
                    gridColumn: 'span 2', background: '#fff', borderRadius: 10,
                    padding: '12px 16px', border: '1px solid rgba(0,0,0,0.07)',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
                      🕐 Hours on Grid (DGR 1.5) — D(s) HH:MM
                    </div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                      {fmtHours(extras.hoursOnGrid)}
                    </div>
                  </div>

                  {/* DGR Row 1.6 — Grid Frequency */}
                  {(extras.freqMin || extras.freqMax || extras.freqAvg) && (
                    <div style={{
                      gridColumn: 'span 1', background: '#fff', borderRadius: 10,
                      padding: '12px 16px', border: '1px solid rgba(0,0,0,0.07)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>
                        📡 Grid Frequency (DGR 1.6)
                      </div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.7 }}>
                        Min — {extras.freqMin || '—'} Hz<br />
                        Max — {extras.freqMax || '—'} Hz<br />
                        Avg — {extras.freqAvg || '—'} Hz
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Grid & Operations */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr"><div className="card-title">📋 Grid Parameters & Operations</div></div>
            <div className="card-body">
              <div className="section-divider"><div className="section-num">A</div> Grid Frequency</div>
              <div className="form-grid-3">
                {[['Freq Min', 'freqMin', 'Hz'], ['Freq Max', 'freqMax', 'Hz'], ['Freq Avg', 'freqAvg', 'Hz']].map(([label, key, unit]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label} <span className="unit">{unit}</span></label>
                    <input className="form-input mono" type="number" step="0.001" placeholder="50.000"
                      disabled={isLocked} value={extras[key]}
                      onChange={e => setExtras(x => ({ ...x, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="section-divider"><div className="section-num">B</div> Operations</div>
              <div className="form-grid-3">
                {[
                  ['Hours on Grid', 'hoursOnGrid', 'HH', 0.5, 0, 24],
                  ['Forced Outages', 'forcedOutages', 'Nos', 1, 0],
                  ['Planned Outages', 'plannedOutages', 'Nos', 1, 0],
                  ['RSD Count', 'rsdCount', 'Nos', 1, 0],
                  ['Partial Loading %', 'partialLoadingPct', '%', 0.1, 0, 100],
                ].map(([label, key, unit, step = 1, min = 0, max]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label} <span className="unit">{unit}</span></label>
                    <input className="form-input mono" type="number" step={step} min={min} max={max}
                      disabled={isLocked} value={extras[key]}
                      onChange={e => setExtras(x => ({ ...x, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Outage Remarks</label>
                  <input className="form-input" type="text" placeholder="Describe any outage or event..."
                    disabled={isLocked} value={extras.outageRemarks}
                    onChange={e => setExtras(x => ({ ...x, outageRemarks: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {isLocked ? (
            <div className="alert alert-info" style={{ marginBottom: 40 }}>
              🔒 This entry is {status} and cannot be edited.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => { setReadings({}); setSavedComputed(null); setSaveErr(null) }}>
                Clear
              </button>
              <div style={{ flex: 1 }} />
              {liveComputed && !savedComputed && (
                <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                  Live: {fmt(liveComputed.generationMU)} MU | PLF {fmt(liveComputed.plfDaily, 1)}%
                </div>
              )}
              <button className="btn btn-primary" onClick={handleSave}
                disabled={saveMutation.isPending} style={{ minWidth: 150 }}>
                {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Draft'}
              </button>
              <button className="btn btn-success"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !existingData?.data?.data}
                title={!existingData?.data?.data ? 'Save draft first' : ''}>
                {submitMutation.isPending ? 'Submitting...' : '✓ Submit for Approval'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
