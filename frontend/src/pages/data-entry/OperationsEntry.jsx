// src/pages/data-entry/OperationsEntry.jsx
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'
import ExcelUploadBtn from '../../components/ExcelUploadBtn'
import { OPERATIONS_FIELDS } from '../../utils/moduleExcel'

const today = new Date().toISOString().split('T')[0]

export default function OperationsEntry() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)

    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()

    // Fetch Operations Data
    const { data: existing } = useQuery({
        queryKey: ['operations-entry', plantId, date],
        queryFn: () => dataEntry.getOperations(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    // Clear form immediately when date or plant changes
    useEffect(() => {
        setForm({})
        setMsg(null)
    }, [date, plantId])

    useEffect(() => {
        const e = existing?.data?.data
        if (e) {
            setForm({
                boilerActivities: e.boiler_activities,
                turbineActivities: e.turbine_activities,
                electricalActivities: e.electrical_activities,
                bopActivities: e.bop_activities,
                runningEquipment: e.running_equipment,
                outageDetails: e.outage_details,
                remarks: e.remarks,
                observations: e.observations,
                status: e.status
            })
        } else {
            setForm({})
        }
    }, [existing])

    const saveMutation = useMutation({
        mutationFn: (data) => dataEntry.saveOperations(data),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ Operations Log saved' })
            qc.invalidateQueries(['operations-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
            setTimeout(() => setMsg(null), 3000)
        },
        onError: (err) => {
            setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to save' })
        }
    })

    const submitMutation = useMutation({
        mutationFn: () => dataEntry.submitOperations({ plantId, entryDate: date }),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ Submitted for approval' })
            qc.invalidateQueries(['operations-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
        },
        onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Submit failed' }),
    })

    const handleSave = () => {
        saveMutation.mutate({ plantId, date, data: form })
    }

    const status = form.status || 'unsubmitted'
    const readOnly = status === 'submitted' || status === 'approved'

    const update = (k, v) => {
        if (readOnly) return
        setForm(p => ({ ...p, [k]: v }))
    }

    const textAreaFields = [
        { label: 'Boiler & Auxiliary Activities', key: 'boilerActivities' },
        { label: 'Turbine & Auxiliary Activities', key: 'turbineActivities' },
        { label: 'Electrical & Instrumentation', key: 'electricalActivities' },
        { label: 'Balance of Plant (BOP)', key: 'bopActivities' },
        { label: 'Running Equipment Status', key: 'runningEquipment' },
        { label: 'Outage / Grid Disturbance Details', key: 'outageDetails' },
        { label: 'Remarks (DGR Section 10.2)', key: 'remarks' },
        { label: 'Observations (DGR Section 10.3)', key: 'observations' }
    ]

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div>
                    <div className="page-title">📋 Operations Log Entry</div>
                    <div className="page-sub">Daily descriptive operational remarks and observations</div>
                </div>
                <ExcelUploadBtn
                    fields={OPERATIONS_FIELDS}
                    currentData={form}
                    entryDate={date}
                    filename={`operations_${date}.xlsx`}
                    onImport={(data) => setForm(f => ({ ...f, ...data }))}
                />
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Entry Date</label>
                            <input
                                className="form-input" type="date" value={date} max={today}
                                onChange={e => { setDate(e.target.value); setForm({}); }}
                            />
                        </div>
                        {status !== 'unsubmitted' && (
                            <div style={{ paddingBottom: 6 }}>
                                <span className={`tag ${status === 'approved' ? 'tag-done' : status === 'submitted' ? 'tag-pend' : 'tag-draft'}`}>
                                    {status.toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!plantId ? (
                <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
            ) : (
                <>
                    <div className="card">
                        <div className="card-hdr"><div className="card-title">📝 Daily Observations</div></div>
                        <div className="card-body">
                            <div className="form-grid-1" style={{ display: 'grid', gap: '16px' }}>
                                {textAreaFields.map(({ label, key }) => (
                                    <div key={key} className="form-group">
                                        <label style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</label>
                                        <textarea
                                            className="input"
                                            rows={3}
                                            value={form[key] || ''}
                                            onChange={e => update(key, e.target.value)}
                                            readOnly={readOnly}
                                            placeholder={`Start typing observations for ${label.toLowerCase()}...`}
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>
                                ))}
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
                            <button className="btn btn-ghost" onClick={() => { setForm({}); }}>
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
