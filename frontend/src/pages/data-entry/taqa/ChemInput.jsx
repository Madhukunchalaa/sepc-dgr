// src/pages/data-entry/taqa/ChemInput.jsx
// 5-field Chem Input form mirroring TAQA Excel "Chem Input" sheet
import { useEffect, useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../../context/PlantContext'
import { dataEntry } from '../../../api'

const F = ({ label, name, unit, form, onChange, step = "0.01" }) => (
    <div className="form-group">
        <label className="form-label">{label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({unit})</span></label>
        <input className="form-input" type="number" step={step} name={name}
            value={form[name] ?? ''} onChange={onChange} />
    </div>
)

export default function ChemInput() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id
    const isTaqa = useMemo(() => selectedPlant?.short_name?.startsWith('TAQA'), [selectedPlant])

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['taqa-chem-input', plantId, date],
        queryFn: () => dataEntry.getTaqaEntry(plantId, date),
        enabled: !!plantId && !!date && isTaqa,
        retry: false,
    })

    // Sync state (mirrors robust OpsInput logic)
    // Clear form when date or plant changes to avoid showing stale data
    useEffect(() => {
        if (isTaqa) {
            setForm({})
            setMsg(null)
        }
    }, [date, plantId, isTaqa])

    useEffect(() => {
        if (!isTaqa) return
        if (isFetching) return

        const row = currentRes?.data?.data ?? {}

        // Guard against stale cached responses
        const rowDate = row?.entry_date ? String(row.entry_date).slice(0, 10) : null
        const rowPlant = row?.plant_id != null ? String(row.plant_id) : null
        if (rowDate && rowDate !== date) return
        if (rowPlant && rowPlant !== String(plantId)) return

        const fields = Object.fromEntries(
            Object.entries(row)
                .filter(([k]) => k.startsWith('chem_'))
                .map(([k, v]) => [k, v ?? ''])
        )
        if (Object.keys(fields).length > 0) {
            setForm(fields)
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        } else {
            setForm({})
        }
    }, [currentRes, isFetching, isTaqa, date, plantId])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveTaqaEntry(plantId, date, form),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ Chem Input saved.' })
            await qc.invalidateQueries({ queryKey: ['taqa-chem-input', plantId, date] })
            await qc.invalidateQueries({ queryKey: ['taqa-ops-input', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })


    return (
        <div style={{ paddingBottom: 40 }}>
            <div className="page-title">🧪 Chem Input — {selectedPlant?.short_name || 'TAQA'}</div>
            <div className="page-sub">Daily Laboratory Data — mirrors Excel "Chem Input" sheet (5 fields)</div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Entry Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={date}
                            onChange={e => { setDate(e.target.value); setMsg(null) }}
                            max={today}
                        />
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Plant: <strong>{selectedPlant?.name}</strong></div>
                    {isFetching && <div style={{ fontSize: 13, color: 'var(--primary)' }}>⏳ Loading data for {date}...</div>}
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="card">
                <div className="card-hdr" style={{ fontWeight: 700 }}>🔬 Laboratory Results (Chem Input)</div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px 24px' }}>
                        <F label="Ash Sales" name="chem_ash_sales_mt" unit="Mton" step="0.001" form={form} onChange={onChange} />
                        <F label="Ash Percentage" name="chem_ash_pct" unit="%" step="0.01" form={form} onChange={onChange} />
                        <F label="GCV Results from NLCIL" name="chem_gcv_nlcil" unit="kCal/kg" step="1" form={form} onChange={onChange} />
                        <F label="UBC in Bottom Ash" name="chem_ubc_bottom_ash" unit="%" step="0.001" form={form} onChange={onChange} />
                        <F label="UBC in Fly Ash" name="chem_ubc_fly_ash" unit="%" step="0.001" form={form} onChange={onChange} />
                    </div>

                    <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
                        <strong>📌 How these values flow to DGR:</strong><br />
                        • <strong>GCV</strong> → used to calculate <strong>Gross Heat Rate (GHR)</strong><br />
                        • <strong>Ash %</strong> → used to estimate <strong>Ash Generation</strong> from Lignite consumed<br />
                        • <strong>Ash Sales</strong> → shown directly in <strong>Ash Details</strong> section of DGR<br />
                        • <strong>UBC</strong> → stored for reference and quality reporting
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !isTaqa}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Chem Data'}
                </button>
            </div>
        </div>
    )
}
