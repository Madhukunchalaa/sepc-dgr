import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

const FIELD = (label, key, unit) => ({ label, key, unit })
const DSM_FIELDS = [
    FIELD('DSM Net Profit', 'dsm_net_profit_lacs', '₹ Lacs'),
    FIELD('DSM Payable', 'dsm_payable_lacs', '₹ Lacs'),
    FIELD('DSM Receivable', 'dsm_receivable_lacs', '₹ Lacs'),
    FIELD('DSM Coal Saving', 'dsm_coal_saving_lacs', '₹ Lacs'),
]

export default function DsmEntry() {
    const { selectedPlant } = usePlant()
    const qc = useQueryClient()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

    const { data: existing, isLoading } = useQuery({
        queryKey: ['dsm-entry', plantId, date],
        queryFn: () => dataEntry.getDsm(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    useEffect(() => {
        const e = existing?.data
        if (e) {
            setForm({
                dsm_net_profit_lacs: e.dsm_net_profit_lacs,
                dsm_payable_lacs: e.dsm_payable_lacs,
                dsm_receivable_lacs: e.dsm_receivable_lacs,
                dsm_coal_saving_lacs: e.dsm_coal_saving_lacs,
            })
        } else {
            setForm({})
        }
    }, [existing])

    const saveMutation = useMutation({
        mutationFn: (data) => dataEntry.saveDsm(data),
        onSuccess: () => {
            setMsg({ type: 'success', text: '✓ DSM entry saved' })
            qc.invalidateQueries(['dsm-entry', plantId, date])
            setTimeout(() => setMsg(null), 3000)
        },
        onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' }),
    })

    const handleSave = () => saveMutation.mutate({ plantId, date, data: form })

    const isLocked = false // DSM doesn't have approval workflow yet

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
            <div className="page-title">💰 DSM Data Entry</div>
            <div className="page-sub">Deviation Settlement Mechanism accounting</div>

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
                        <div className="card-hdr"><div className="card-title">DSM Financials</div></div>
                        <div className="card-body">
                            <div className="form-grid-3">{DSM_FIELDS.map(f => <FieldInput key={f.key} field={f} />)}</div>
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
