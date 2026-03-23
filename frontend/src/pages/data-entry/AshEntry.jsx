import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'
import ExcelUploadBtn from '../../components/ExcelUploadBtn'
import { ASH_FIELDS } from '../../utils/moduleExcel'

const today = new Date().toISOString().split('T')[0]


const FieldInput = ({ field, form, isLocked, onChange }) => (
    <div className="form-group">
        <label className="form-label">{field.label} <span className="unit">{field.unit}</span></label>
        <input
            className="form-input mono" type="number" step="0.001" placeholder="0.000"
            value={form[field.key] ?? ''}
            disabled={isLocked}
            onChange={e => onChange(field.key, e.target.value)}
        />
    </div>
)

export default function AshEntry() {
    const { selectedPlant } = usePlant()
    const qc = useQueryClient()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

    const { data: existing, isLoading } = useQuery({
        queryKey: ['ash-entry', plantId, date],
        queryFn: () => dataEntry.getAsh(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    useEffect(() => {
        const e = existing?.data
        if (e) {
            setForm({
                fa_to_user_mt: e.fa_to_user_mt,
                fa_to_dyke_mt: e.fa_to_dyke_mt,
                fa_generated_mt: e.fa_generated_mt,
                fa_silo_mt: e.fa_silo_mt,
                ba_to_user_mt: e.ba_to_user_mt,
                ba_to_dyke_mt: e.ba_to_dyke_mt,
                ba_generated_mt: e.ba_generated_mt,
                ba_silo_mt: e.ba_silo_mt,
            })
        } else {
            setForm({})
        }
    }, [existing])

    const saveMutation = useMutation({
        mutationFn: (data) => dataEntry.saveAsh(data),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ Ash entry saved' })
            qc.invalidateQueries(['ash-entry', plantId, date])
            setTimeout(() => setMsg(null), 3000)
        },
        onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' }),
    })

    const handleSave = () => saveMutation.mutate({ plantId, date, data: form })

    const isLocked = false // Ash doesn't have approval workflow yet


    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div>
                    <div className="page-title">💨 Ash Data Entry</div>
                    <div className="page-sub">Daily generation and disposal of ash</div>
                </div>
                <ExcelUploadBtn
                    fields={ASH_FIELDS}
                    currentData={form}
                    entryDate={date}
                    filename={`ash_${date}.xlsx`}
                    onImport={(data) => setForm(f => ({ ...f, ...data }))}
                />
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Entry Date</label>
                            <input className="form-input" type="date" value={date} max={today}
                                onChange={e => setDate(e.target.value)} />
                        </div>
                        {isLoading && <div style={{ marginBottom: 10, color: 'var(--muted)' }}>Loading...</div>}
                        {existing?.data?.status && (
                            <span className={`tag tag-draft`}>
                                {existing.data.status.toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {!plantId ? (
                <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
            ) : (
                <>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-hdr"><div className="card-title">Ash Breakdown</div></div>
                        <div className="card-body">
                            <div className="form-grid-3">{ASH_FIELDS.map(f => <FieldInput key={f.key} field={f} form={form} isLocked={isLocked} onChange={set} />)}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
                        <button className="btn btn-ghost" onClick={() => setForm({})}>Clear</button>
                        <div style={{ flex: 1 }} />
                        <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending} style={{ minWidth: 150 }}>
                            {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Changes'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
