import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const F = ({ label, name, type="text", form, onChange }) => (
    <div className="form-group">
        <label className="form-label" style={{fontWeight: 'bold'}}>{label}</label>
        {type === 'textarea' ? (
            <textarea className="form-input" name={name} value={form[name] ?? ''} onChange={onChange} rows={3} />
        ) : (
            <input className="form-input" type={type} name={name} value={form[name] ?? ''} onChange={onChange} />
        )}
    </div>
)

export default function UnitTripReport() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-trip', plantId, date],
        queryFn: () => dataEntry.getMisTrip(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    useEffect(() => {
        setForm({})
        setMsg(null)
    }, [date, plantId])

    useEffect(() => {
        if (isFetching) return
        const row = currentRes?.data?.data ?? {}
        if (row.id) {
            setForm(row)
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        } else {
            const formHasData = Object.keys(form).some(k => form[k] !== '' && form[k] !== null)
            if (!formHasData) setForm({})
        }
    }, [currentRes, isFetching, date, plantId])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveMisTrip({ plantId, entryDate: date, data: form }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ Trip Report saved.' })
            await qc.invalidateQueries({ queryKey: ['mis-trip', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    return (
        <div style={{ paddingBottom: 40 }} className="print-container">
            <style>
                {`
                    @media print {
                        .no-print, .card, .page-title, .page-sub { display: none !important; }
                        .sidebar, .topbar { display: none !important; }
                        header { display: none !important; }
                        #root, body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
                        main { margin: 0 !important; padding: 20px !important; width: 100% !important; max-width: 100% !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .print-container { padding: 0 !important; width: 100% !important; background: white !important; margin: 0 !important; position: absolute; top: 0; left: 0; width: 100vw; }
                        .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 0 20px 0 !important; page-break-inside: avoid; }
                        .form-input { border: none !important; border-bottom: 1px solid #ccc !important; border-radius: 0 !important; padding: 0 !important; }
                        textarea.form-input { resize: none; overflow: visible; height: auto; min-height: 50px; }
                        .grid-2 { grid-template-columns: 1fr 1fr !important; }
                    }
                `}
            </style>
            <div className="page-title no-print">⚠️ Unit Trip Report — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Trip Date</label>
                        <input
                            className="form-input" type="date" value={date} 
                            onChange={e => { setDate(e.target.value); setMsg(null) }}
                            max={today}
                        />
                    </div>
                    {isFetching && <div style={{ fontSize: 13, color: 'var(--primary)' }}>⏳ Loading data...</div>}
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-hdr" style={{ fontWeight: 700, fontSize: '1.2rem', textAlign: 'center' }}>
                    UNIT TRIP ANALYSIS REPORT
                </div>
                <div className="card-body">
                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <F label="Trip Report #" name="trip_report_no" form={form} onChange={onChange} />
                        <F label="Report Date" name="report_date" type="date" form={form} onChange={onChange} />
                        <F label="Trip Time" name="trip_time" type="time" form={form} onChange={onChange} />
                        <F label="Trip Duration" name="trip_duration" form={form} onChange={onChange} />
                    </div>
                    
                    <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Pre-existing Unit Load and Control Mode" name="pre_existing_load" type="textarea" form={form} onChange={onChange} />
                        <F label="System/Equipment Abnormal Conditions" name="system_abnormal_conditions" type="textarea" form={form} onChange={onChange} />
                        <F label="Equipment Tripped" name="equipment_tripped" type="textarea" form={form} onChange={onChange} />
                        <F label="Root Cause" name="root_cause" type="textarea" form={form} onChange={onChange} />
                        <F label="Immediate Actions taken before the trip" name="immediate_actions" type="textarea" form={form} onChange={onChange} />
                        <F label="Consequential Damage Resulting from Trip" name="consequential_damage" type="textarea" form={form} onChange={onChange} />
                        <F label="Actions Taken to Restart the Unit" name="actions_taken_to_restart" type="textarea" form={form} onChange={onChange} />
                        <F label="Committee Observation" name="committee_observation" type="textarea" form={form} onChange={onChange} />
                        <F label="Recommendation" name="recommendation" type="textarea" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Report</button>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Trip Data'}
                </button>
            </div>
        </div>
    )
}
