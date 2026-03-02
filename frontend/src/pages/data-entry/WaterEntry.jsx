// src/pages/data-entry/WaterEntry.jsx
import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

function fmt(val, dec = 3) {
    if (val == null || isNaN(val) || !isFinite(val)) return '—'
    return parseFloat(val).toFixed(dec)
}

export default function WaterEntry() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()

    // Fetch Water Data
    const { data: existing } = useQuery({
        queryKey: ['water-entry', plantId, date],
        queryFn: () => dataEntry.getWater(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    // We need generation_mu for the DM Cycle % formulas, so we query power entry
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
                dmGenerationM3: e.dm_generation_m3,
                dmCycleMakeupM3: e.dm_cycle_makeup_m3,
                dmTotalConsM3: e.dm_total_cons_m3,
                dmStockM3: e.dm_stock_m3,
                serviceWaterM3: e.service_water_m3,
                potableWaterM3: e.potable_water_m3,
                seaWaterM3: e.sea_water_m3,
            })

            setSavedComputed({
                dmCyclePct: e.dm_cycle_pct,
            })
        } else {
            setForm({})
            setSavedComputed(null)
        }
    }, [existing, powerData])

    // Compute live values dynamically exactly like the backend
    const liveComputed = useMemo(() => {
        if (!plantId) return null
        if (!form.dmCycleMakeupM3) return null

        const genMu = Number(powerData?.data?.data?.generation_mu || 0)
        if (genMu === 0) return null

        const dmMakeup = Number(form.dmCycleMakeupM3 || 0)
        const dmCyclePct = genMu > 0 ? (dmMakeup * 100) / (genMu * 1000) : 0

        return { dmCyclePct, genMu }
    }, [form, plantId, powerData])

    const saveMutation = useMutation({
        mutationFn: (data) => dataEntry.saveWater(data),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ Water entry saved' })
            qc.invalidateQueries(['water-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
            setTimeout(() => setMsg(null), 3000)
        },
        onError: (err) => {
            setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to save' })
        }
    })

    const handleSave = () => {
        saveMutation.mutate({
            plantId, date, data: form
        })
    }

    const submitMutation = useMutation({
        mutationFn: () => dataEntry.submitWater({ plantId, entryDate: date }),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ Submitted for approval' })
            qc.invalidateQueries(['water-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
        },
        onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Submit failed' }),
    })

    const status = existing?.data?.data?.status || 'unsubmitted'
    const readOnly = status === 'submitted' || status === 'approved'

    const update = (key, val) => {
        if (readOnly) return
        setForm(prev => ({ ...prev, [key]: val }))
    }

    return (
        <div>
            <div className="page-title">🌊 Water Consumption Entry</div>
            <div className="page-sub">Daily DM, Potable, and Service water metrics</div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Entry Date</label>
                            <input
                                className="form-input" type="date" value={date} max={today}
                                onChange={e => { setDate(e.target.value); setSavedComputed(null); setForm({}); }}
                            />
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
                                        ⚠ Power Generation must be submitted first to compute natively.
                                    </div>
                                )}
                            </div>
                            <div className="card-body">
                                <div className="form-grid-3">
                                    <div style={{
                                        background: '#fff', borderRadius: 10, padding: '12px 16px',
                                        border: '1px solid rgba(0,0,0,0.07)',
                                    }}>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>DM Cycle %</div>
                                        <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                                            {fmt(liveComputed?.dmCyclePct ?? savedComputed?.dmCyclePct, 2)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>%</span>
                                        </div>
                                    </div>

                                    {liveComputed?.genMu > 0 && (
                                        <div style={{ gridColumn: 'span 3', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                                            💡 Formulas computed utilizing <b>{fmt(liveComputed.genMu, 4)} MU</b> of Generation Power.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-grid-2">

                        {/* DM Water */}
                        <div className="card">
                            <div className="card-hdr"><div className="card-title">💧 DM Water</div></div>
                            <div className="card-body">
                                <div className="form-grid-2">
                                    {[
                                        ['DM Generation', 'dmGenerationM3', 'm3'],
                                        ['Cycle Makeup', 'dmCycleMakeupM3', 'm3'],
                                        ['Total Consumption', 'dmTotalConsM3', 'm3'],
                                        ['Stock', 'dmStockM3', 'm3'],
                                    ].map(([label, key, unit]) => (
                                        <div key={key} className="form-group">
                                            <label>{label}</label>
                                            <div className="input-with-unit">
                                                <input
                                                    type="number" className="form-input mono"
                                                    value={form[key] ?? ''}
                                                    onChange={e => update(key, e.target.value)}
                                                    readOnly={readOnly}
                                                    placeholder="0.00"
                                                />
                                                <span className="unit">{unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Other Water */}
                        <div className="card">
                            <div className="card-hdr"><div className="card-title">🌊 Raw & Domestic Water</div></div>
                            <div className="card-body">
                                <div className="form-grid-2">
                                    {[
                                        ['Service Water Consumption', 'serviceWaterM3', 'm3'],
                                        ['Potable Water Consumption', 'potableWaterM3', 'm3'],
                                        ['Sea Water Consumption', 'seaWaterM3', 'm3'],
                                    ].map(([label, key, unit]) => (
                                        <div key={key} className="form-group">
                                            <label>{label}</label>
                                            <div className="input-with-unit">
                                                <input
                                                    type="number" className="form-input mono"
                                                    value={form[key] ?? ''}
                                                    onChange={e => update(key, e.target.value)}
                                                    readOnly={readOnly}
                                                    placeholder="0.00"
                                                />
                                                <span className="unit">{unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Actions */}
                    {readOnly ? (
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
