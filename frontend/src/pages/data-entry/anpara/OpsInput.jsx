// src/pages/data-entry/anpara/OpsInput.jsx
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../../context/PlantContext'
import { dataEntry } from '../../../api'

const F = ({ label, name, unit, form, onChange }) => (
    <div className="form-group">
        <label className="form-label">{label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({unit})</span></label>
        <input className="form-input" type="number" step="any" name={name} value={form?.[name] ?? ''} onChange={onChange} />
    </div>
)

const Section = ({ title, children }) => (
    <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-hdr" style={{ fontWeight: 700 }}>{title}</div>
        <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px 20px' }}>
                {children}
            </div>
        </div>
    </div>
)

export default function AnparaOpsInput() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()

    const plantId = selectedPlant?.id
    const isAnpara = useMemo(() => selectedPlant?.short_name === 'ANPARA', [selectedPlant])

    const { data: res, isFetching } = useQuery({
        queryKey: ['anpara-ops-input', plantId, date],
        queryFn: () => dataEntry.getAnparaEntry(plantId, date),
        enabled: !!plantId && !!date && isAnpara,
        retry: false,
    })

    useEffect(() => { setForm({}); setMsg(null) }, [date, plantId])

    useEffect(() => {
        if (!isAnpara || isFetching) return
        const row = res?.data?.data
        if (row && Object.keys(row).length > 0) {
            const { id, plant_id, entry_date, created_at, updated_at, submitted_by, submitted_at, approved_by, approved_at, status, ...fields } = row
            setForm(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v == null ? '' : String(v)])))
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        } else {
            setForm({})
        }
    }, [res, isFetching, isAnpara, date])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveAnparaEntry(plantId, date, form),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✅ Saved as draft.' })
            qc.invalidateQueries({ queryKey: ['anpara-ops-input', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    const submitMutation = useMutation({
        mutationFn: () => dataEntry.submitAnparaEntry(plantId, date),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✅ Submitted! DGR report is now available.' })
            qc.invalidateQueries({ queryKey: ['anpara-ops-input', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Submit failed' }),
    })

    const p = { form, onChange }

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-title">📋 Daily Ops Input — Anpara</div>
            <div className="page-sub">MEIL Anpara Energy Limited — 2 × 600 MW</div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Entry Date</label>
                        <input className="form-input" type="date" value={date} max={today}
                            onChange={e => { setDate(e.target.value); setMsg(null) }} />
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Plant: <strong>{selectedPlant?.name || 'None'}</strong></div>
                    {isFetching && <div style={{ fontSize: 13, color: 'var(--primary)' }}>⏳ Loading...</div>}
                    {!isAnpara && (
                        <div style={{ fontSize: 12, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 6 }}>
                            ⚠️ Please select ANPARA plant from sidebar.
                        </div>
                    )}
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            {/* ── UNIT 1 GENERATION ─────────────────────────────────────────── */}
            <Section title="⚡ Unit #1 — Generation & Consumption">
                <F label="Run Hours"           name="u1_run_hours"    unit="hrs"    {...p} />
                <F label="Generation"          name="u1_gen_mu"       unit="MU"     {...p} />
                <F label="APC"                 name="u1_apc_mu"       unit="MU"     {...p} />
                <F label="Coal Consumption"    name="u1_coal_mt"      unit="MT"     {...p} />
                <F label="LDO Consumption"     name="u1_oil_ldo_kl"   unit="KL"     {...p} />
                <F label="DM Water (Hot well)" name="u1_dm_water_m3"  unit="M³"     {...p} />
                <F label="H2 Cylinders"        name="u1_h2_cylinders" unit="Nos"    {...p} />
            </Section>

            {/* ── UNIT 2 GENERATION ─────────────────────────────────────────── */}
            <Section title="⚡ Unit #2 — Generation & Consumption">
                <F label="Run Hours"           name="u2_run_hours"    unit="hrs"    {...p} />
                <F label="Generation"          name="u2_gen_mu"       unit="MU"     {...p} />
                <F label="APC"                 name="u2_apc_mu"       unit="MU"     {...p} />
                <F label="Coal Consumption"    name="u2_coal_mt"      unit="MT"     {...p} />
                <F label="LDO Consumption"     name="u2_oil_ldo_kl"   unit="KL"     {...p} />
                <F label="DM Water (Hot well)" name="u2_dm_water_m3"  unit="M³"     {...p} />
                <F label="H2 Cylinders"        name="u2_h2_cylinders" unit="Nos"    {...p} />
            </Section>

            {/* ── STATION ───────────────────────────────────────────────────── */}
            <Section title="🏭 Station — Scheduling & Stock">
                <F label="DC (UPPCL)"         name="dc_uppcl_mu"       unit="MU"  {...p} />
                <F label="DC (Third Party)"   name="dc_third_party_mu" unit="MU"  {...p} />
                <F label="SG (Schedule Gen)"  name="sg_mu"             unit="MU"  {...p} />
                <F label="AG (Net Export)"    name="net_export_mu"     unit="MU"  {...p} />
                <F label="Coal Received"      name="coal_received_mt"  unit="MT"  {...p} />
                <F label="Coal Stock"         name="coal_stock_mt"     unit="MT"  {...p} />
                <F label="LDO Received"       name="ldo_received_kl"   unit="KL"  {...p} />
                <F label="Raw Water"          name="raw_water_m3"      unit="M³"  {...p} />
            </Section>

            {/* ── DC LOSS UNIT 1 ────────────────────────────────────────────── */}
            <Section title="📉 DC Loss — Unit #1 (MU)">
                <F label="BTL Loss"              name="u1_btl_loss_mu"        unit="MU" {...p} />
                <F label="Equipment Problem"     name="u1_equip_loss_mu"      unit="MU" {...p} />
                <F label="Planned Outage"        name="u1_planned_loss_mu"    unit="MU" {...p} />
                <F label="Unit Trip"             name="u1_trip_loss_mu"       unit="MU" {...p} />
                <F label="Coal Constraint"       name="u1_coal_constraint_mu" unit="MU" {...p} />
                <F label="Grid Backing Down"     name="u1_grid_backing_mu"    unit="MU" {...p} />
            </Section>

            {/* ── DC LOSS UNIT 2 ────────────────────────────────────────────── */}
            <Section title="📉 DC Loss — Unit #2 (MU)">
                <F label="BTL Loss"              name="u2_btl_loss_mu"        unit="MU" {...p} />
                <F label="Equipment Problem"     name="u2_equip_loss_mu"      unit="MU" {...p} />
                <F label="Planned Outage"        name="u2_planned_loss_mu"    unit="MU" {...p} />
                <F label="Unit Trip"             name="u2_trip_loss_mu"       unit="MU" {...p} />
                <F label="Coal Constraint"       name="u2_coal_constraint_mu" unit="MU" {...p} />
                <F label="Grid Backing Down"     name="u2_grid_backing_mu"    unit="MU" {...p} />
            </Section>

            {/* ── DSM ───────────────────────────────────────────────────────── */}
            <Section title="💰 DSM">
                <F label="DSM (₹)"        name="dsm_rs"        unit="₹"  {...p} />
                <F label="Net Saving (₹)" name="net_saving_rs" unit="₹"  {...p} />
            </Section>

            {/* ── STICKY SAVE/SUBMIT ────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '16px 0', borderTop: '1px solid var(--border)', zIndex: 10 }}>
                <button className="btn btn-ghost" onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !isAnpara}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Draft'}
                </button>
                <button className="btn btn-primary" onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || !isAnpara}>
                    {submitMutation.isPending ? '⏳ Submitting...' : '✅ Submit'}
                </button>
            </div>
        </div>
    )
}
