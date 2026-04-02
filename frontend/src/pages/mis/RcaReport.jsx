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

export default function RcaReport() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-rca', plantId, date],
        queryFn: () => dataEntry.getMisRca(plantId, date),
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
        mutationFn: () => dataEntry.saveMisRca({ plantId, entryDate: date, data: form }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ RCA Report saved.' })
            await qc.invalidateQueries({ queryKey: ['mis-rca', plantId, date] })
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
            <div className="page-title no-print">🔍 RCA Report — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Incident Date</label>
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
                    ROOT CAUSE ANALYSIS REPORT
                </div>
                <div className="card-body">
                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <F label="RCA No." name="rca_no" form={form} onChange={onChange} />
                        <F label="Report Date" name="report_date" type="date" form={form} onChange={onChange} />
                        <F label="System" name="system_name" form={form} onChange={onChange} />
                        <F label="Equipment" name="equipment_name" form={form} onChange={onChange} />
                        <F label="KKS" name="kks_code" form={form} onChange={onChange} />
                        <F label="Total Duration of Breakdown/Outage" name="breakdown_duration" form={form} onChange={onChange} />
                        <F label="RCA Team" name="rca_team" form={form} onChange={onChange} />
                        <F label="Technical Team" name="technical_team" form={form} onChange={onChange} />
                    </div>
                    
                    <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Fault / Breakdown / Defect / Event" name="fault_defect_event" type="textarea" form={form} onChange={onChange} />
                        <F label="Any HSE Impact?" name="hse_impact" type="textarea" form={form} onChange={onChange} />
                        <F label="Conditions Prior to Failure" name="conditions_prior" type="textarea" form={form} onChange={onChange} />
                        <F label="Sequence of Events of failure" name="sequence_of_events" type="textarea" form={form} onChange={onChange} />
                        <F label="Observations / Findings" name="observations" type="textarea" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-hdr" style={{ fontWeight: 700 }}>Why-Why Analysis</div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Why 1" name="why1" type="textarea" form={form} onChange={onChange} />
                        <F label="Why 2" name="why2" type="textarea" form={form} onChange={onChange} />
                        <F label="Why 3" name="why3" type="textarea" form={form} onChange={onChange} />
                        <F label="Direct Cause" name="direct_cause" type="textarea" form={form} onChange={onChange} />
                        <F label="Underlying Cause" name="underlying_cause" type="textarea" form={form} onChange={onChange} />
                        <F label="Root Cause" name="root_cause" type="textarea" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-hdr" style={{ fontWeight: 700 }}>Actions & Recommendations</div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Preventive Actions Taken" name="preventive_actions" type="textarea" form={form} onChange={onChange} />
                        <F label="Corrective Actions Taken" name="corrective_actions" type="textarea" form={form} onChange={onChange} />
                        <F label="Recommendations to Avoid Recurrence" name="recommendations" type="textarea" form={form} onChange={onChange} />
                    </div>
                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 16 }}>
                        <F label="Action Plan Target Date" name="action_plan_target_date" form={form} onChange={onChange} />
                        <F label="Action Owners" name="action_owners" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-hdr" style={{ fontWeight: 700 }}>Review & Sign-off</div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Similar Incidents" name="similar_incidents" type="textarea" form={form} onChange={onChange} />
                        <F label="Comments / Learnings / Feedback" name="comments_learnings" type="textarea" form={form} onChange={onChange} />
                        <F label="Reviewer's Comment" name="reviewer_comment" type="textarea" form={form} onChange={onChange} />
                    </div>
                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 16 }}>
                        <F label="Prepared By" name="prepared_by" form={form} onChange={onChange} />
                        <F label="Checked By" name="checked_by" form={form} onChange={onChange} />
                        <F label="Reviewed By" name="reviewed_by" form={form} onChange={onChange} />
                        <F label="Approved By" name="approved_by" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Report</button>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save RCA Data'}
                </button>
            </div>
        </div>
    )
}
