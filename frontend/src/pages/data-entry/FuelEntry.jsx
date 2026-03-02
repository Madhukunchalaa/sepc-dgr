// src/pages/data-entry/FuelEntry.jsx
import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

function fmt(val, dec = 3) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return parseFloat(val).toFixed(dec)
}

const FIELD = (label, key, unit, section) => ({ label, key, unit, section })
const COAL_FIELDS = [
  FIELD('Coal Receipt', 'coalReceiptMt', 'MT', 'coal'),
  FIELD('Coal Consumption', 'coalConsMt', 'MT', 'coal'),
  FIELD('Coal Stock', 'coalStockMt', 'MT', 'coal'),
  FIELD('GCV (As Rec.)', 'coalGcvAr', 'kCal/kg', 'coal'),
  FIELD('GCV (As Fired)', 'coalGcvAf', 'kCal/kg', 'coal'),
]
const LDO_FIELDS = [
  FIELD('LDO Receipt', 'ldoReceiptKl', 'KL', 'ldo'),
  FIELD('LDO Consumption', 'ldoConsKl', 'KL', 'ldo'),
  FIELD('LDO Stock', 'ldoStockKl', 'KL', 'ldo'),
  FIELD('LDO Rate', 'ldoRate', '₹/KL', 'ldo'),
]
const HFO_FIELDS = [
  FIELD('HFO Receipt', 'hfoReceiptKl', 'KL', 'hfo'),
  FIELD('HFO Consumption', 'hfoConsKl', 'KL', 'hfo'),
  FIELD('HFO Stock', 'hfoStockKl', 'KL', 'hfo'),
  FIELD('HFO Rate', 'hfoRate', '₹/KL', 'hfo'),
]
const GAS_FIELDS = [
  FIELD('H₂ Receipt', 'h2Receipt', 'Nos', 'gas'),
  FIELD('H₂ Consumed', 'h2Cons', 'Nos', 'gas'),
  FIELD('H₂ Stock', 'h2Stock', 'Nos', 'gas'),
  FIELD('CO₂ Receipt', 'co2Receipt', 'Nos', 'gas'),
  FIELD('CO₂ Consumed', 'co2Cons', 'Nos', 'gas'),
  FIELD('CO₂ Stock', 'co2Stock', 'Nos', 'gas'),
  FIELD('N₂ Receipt', 'n2Receipt', 'Nos', 'gas'),
  FIELD('N₂ Consumed', 'n2Cons', 'Nos', 'gas'),
  FIELD('N₂ Stock', 'n2Stock', 'Nos', 'gas'),
]

export default function FuelEntry() {
  const { selectedPlant } = usePlant()
  const qc = useQueryClient()
  const plantId = selectedPlant?.id
  const [date, setDate] = useState(today)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const { data: existing } = useQuery({
    queryKey: ['fuel-entry', plantId, date],
    queryFn: () => dataEntry.getFuel(plantId, date),
    enabled: !!plantId && !!date,
    retry: false,
  })

  // We need generation_mu for the formulas, so we query the power entry
  const { data: powerData } = useQuery({
    queryKey: ['power-entry', plantId, date],
    queryFn: () => dataEntry.getPower(plantId, date),
    enabled: !!plantId && !!date,
    retry: false,
  })

  const [savedComputed, setSavedComputed] = useState(null)

  useEffect(() => {
    const e = existing?.data?.data
    if (e) {
      setForm({
        coalReceiptMt: e.coal_receipt_mt, coalConsMt: e.coal_cons_mt, coalStockMt: e.coal_stock_mt,
        coalGcvAr: e.coal_gcv_ar, coalGcvAf: e.coal_gcv_af,
        ldoReceiptKl: e.ldo_receipt_kl, ldoConsKl: e.ldo_cons_kl, ldoStockKl: e.ldo_stock_kl, ldoRate: e.ldo_rate,
        hfoReceiptKl: e.hfo_receipt_kl, hfoConsKl: e.hfo_cons_kl, hfoStockKl: e.hfo_stock_kl, hfoRate: e.hfo_rate,
        h2Receipt: e.h2_receipt, h2Cons: e.h2_cons, h2Stock: e.h2_stock,
        co2Receipt: e.co2_receipt, co2Cons: e.co2_cons, co2Stock: e.co2_stock,
        n2Receipt: e.n2_receipt, n2Cons: e.n2_cons, n2Stock: e.n2_stock,
      })

      // Attempt to extract computed variables if they were provided (or manually calculate them based on saved row)
      const genMu = Number(powerData?.data?.data?.generation_mu || 0)
      const ghrDirect = genMu > 0 ? (((Number(e.coal_gcv_af || 0) * Number(e.coal_cons_mt || 0)) + ((Number(e.ldo_cons_kl || 0) + Number(e.hfo_cons_kl || 0)) * 10700)) / (genMu * 1000)) : null;

      setSavedComputed({
        sccKgKwh: e.scc_kg_kwh,
        socMlKwh: e.soc_ml_kwh,
        ghrDirect: ghrDirect,
      })
    } else {
      setForm({})
      setSavedComputed(null)
    }
  }, [existing, powerData])

  // Compute live values dynamically exactly like the backend
  const liveComputed = useMemo(() => {
    if (!plantId) return null
    if (!form.coalConsMt && !form.ldoConsKl && !form.hfoConsKl) return null

    const genMu = Number(powerData?.data?.data?.generation_mu || 0)
    if (genMu === 0) return null // Need power to compute formulas

    const coalMt = Number(form.coalConsMt || 0)
    const ldoKl = Number(form.ldoConsKl || 0)
    const hfoKl = Number(form.hfoConsKl || 0)
    const gcvAf = Number(form.coalGcvAf || 0)

    const genKwh = genMu * 1000000
    const coalKg = coalMt * 1000

    const sccKgKwh = genKwh > 0 ? coalKg / genKwh : 0
    const socMlKwh = genMu > 0 ? (ldoKl + hfoKl) / genMu : 0
    const ghrDirect = genMu > 0 ? (((gcvAf * coalMt) + ((ldoKl + hfoKl) * 10700)) / (genMu * 1000)) : 0

    return { sccKgKwh, socMlKwh, ghrDirect, genMu }
  }, [form, plantId, powerData])



  const saveMutation = useMutation({
    mutationFn: (data) => dataEntry.saveFuel(data),
    onSuccess: () => {
      setMsg({ type: 'success', text: '✓ Fuel entry saved' })
      qc.invalidateQueries(['fuel-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId])
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' }),
  })

  const submitMutation = useMutation({
    mutationFn: () => dataEntry.submitFuel({ plantId, entryDate: date }),
    onSuccess: () => {
      setMsg({ type: 'success', text: '✓ Submitted for approval' })
      qc.invalidateQueries(['submission-status', plantId])
    },
  })

  const handleSave = () => saveMutation.mutate({ plantId, entryDate: date, ...form })

  const status = existing?.data?.data?.status || 'unsubmitted'
  const isLocked = status === 'submitted' || status === 'approved'

  const FieldInput = ({ field }) => (
    <div className="form-group">
      <label className="form-label">{field.label} <span className="unit">{field.unit}</span></label>
      <input
        className="form-input mono" type="number" step="0.001" placeholder="0.000"
        value={form[field.key] ?? ''}
        disabled={isLocked}
        onChange={e => set(field.key, e.target.value)}
      />
    </div>
  )

  return (
    <div>
      <div className="page-title">🔥 Fuel & Performance Entry</div>
      <div className="page-sub">Daily fuel consumption, receipts, and stock</div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Date row */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Entry Date</label>
              <input className="form-input" type="date" value={date} max={today}
                onChange={e => setDate(e.target.value)} />
            </div>
            {existing?.data?.data?.status && (
              <span className={`tag ${existing.data.data.status === 'approved' ? 'tag-done' : existing.data.data.status === 'submitted' ? 'tag-pend' : 'tag-draft'}`}>
                {existing.data.data.status.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {!plantId ? (
        <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
      ) : (
        <>
          {/* Live / Saved Computed Panel */}
          {(savedComputed || liveComputed) && (
            <div className="card" style={{
              marginBottom: 20,
              border: `2px solid ${savedComputed ? '#16a34a' : '#2563eb'}`,
            }}>
              <div className="card-hdr" style={{ background: savedComputed ? '#dcfce7' : '#dbeafe' }}>
                <div className="card-title" style={{ color: savedComputed ? '#16a34a' : '#2563eb' }}>
                  {savedComputed ? '✅ Saved & Computed (Server)' : '⚡ Live Preview (Client-side estimate)'}
                </div>
                {!powerData?.data?.data?.generation_mu && (
                  <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                    ⚠ Power Generation must be submitted first to compute KPIs natively.
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="form-grid-3">
                  {[
                    ['SCC (Coal)', fmt(liveComputed?.sccKgKwh ?? savedComputed?.sccKgKwh, 4), 'kg/kWh'],
                    ['SOC (Oil)', fmt(liveComputed?.socMlKwh ?? savedComputed?.socMlKwh, 4), 'ml/kWh'],
                    ['GHR (Heat Rate)', fmt(liveComputed?.ghrDirect ?? savedComputed?.ghrDirect, 2), 'kCal/kWh'],
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

                  {liveComputed?.genMu > 0 && (
                    <div style={{ gridColumn: 'span 3', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      💡 Formulas computed utilizing <b>{fmt(liveComputed.genMu, 4)} MU</b> of Generation Power.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Coal */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hdr"><div className="card-title">🏔 Coal</div></div>
            <div className="card-body">
              <div className="form-grid-3">{COAL_FIELDS.map(f => <FieldInput key={f.key} field={f} />)}</div>
            </div>
          </div>

          {/* LDO & HFO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-hdr"><div className="card-title">🛢 Light Diesel Oil (LDO)</div></div>
              <div className="card-body">{LDO_FIELDS.map(f => <FieldInput key={f.key} field={f} />)}</div>
            </div>
            <div className="card">
              <div className="card-hdr"><div className="card-title">🛢 Heavy Fuel Oil (HFO)</div></div>
              <div className="card-body">{HFO_FIELDS.map(f => <FieldInput key={f.key} field={f} />)}</div>
            </div>
          </div>

          {/* Gases */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr"><div className="card-title">💨 Gas Cylinders</div></div>
            <div className="card-body">
              <div className="form-grid-3">{GAS_FIELDS.map(f => <FieldInput key={f.key} field={f} />)}</div>
            </div>
          </div>

          {/* Actions */}
          {isLocked ? (
            <div className="alert alert-info" style={{ marginBottom: 40 }}>
              🔒 This entry is {status} and cannot be edited.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => { setForm({}); setSavedComputed(null) }}>
                Clear
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending} style={{ minWidth: 150 }}>
                {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Draft'}
              </button>
              <button className="btn btn-success"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !existing?.data?.data}
                title={!existing?.data?.data ? 'Save draft first' : ''}>
                {submitMutation.isPending ? 'Submitting...' : '✓ Submit for Approval'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
