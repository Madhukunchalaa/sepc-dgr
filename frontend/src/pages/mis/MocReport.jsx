import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const F = ({ label, name, type="text", form, onChange }) => (
    <div className="form-group">
        <label className="form-label" style={{fontWeight: 'bold', fontSize: 13}}>{label}</label>
        <input className="form-input" type={type} name={name} value={form[name] ?? ''} onChange={onChange} />
    </div>
)

const TA = ({ label, name, form, onChange }) => (
    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label className="form-label" style={{fontWeight: 'bold', fontSize: 13}}>{label}</label>
        <textarea className="form-input" name={name} value={form[name] ?? ''} onChange={onChange} rows={3} style={{resize: 'vertical'}} />
    </div>
)

export default function MocReport() {
    const { selectedPlant } = usePlant()
    const [mocNo, setMocNo] = useState('')
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-moc', plantId, mocNo],
        queryFn: () => dataEntry.getMisMoc(plantId, mocNo),
        enabled: !!plantId && !!mocNo,
        retry: false,
    })

    useEffect(() => {
        if (!mocNo) {
            setForm({})
            setMsg(null)
        }
    }, [mocNo])

    useEffect(() => {
        if (isFetching || !mocNo) return
        const row = currentRes?.data?.data ?? {}
        if (row.id) {
            setForm(row.data || {})
            setMsg({ type: 'info', text: `📂 Loaded saved MoC data` })
        } else {
            setForm({})
            setMsg({ type: 'info', text: `✨ Creating new MoC` })
        }
    }, [currentRes, isFetching, mocNo])

    const onChange = e => {
        if (e.target.type === 'checkbox') {
            setForm(f => ({ ...f, [e.target.name]: e.target.checked }))
        } else if (e.target.type === 'radio') {
            setForm(f => ({ ...f, [e.target.name]: e.target.value }))
        } else {
            setForm(f => ({ ...f, [e.target.name]: e.target.value }))
        }
    }

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveMisMoc({ plantId, mocNo, initiationDate: form.initiation_date, data: form }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ MoC updated successfully.' })
            await qc.invalidateQueries({ queryKey: ['mis-moc', plantId, mocNo] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    const Radio = ({ name, value, label }) => (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginRight: 16 }}>
            <input type="radio" name={name} value={value} checked={form[name] === value} onChange={onChange} />
            {label}
        </label>
    )

    return (
        <div style={{ paddingBottom: 40 }} className="incident-container">
            <style>
                {`
                    .print-only { display: none; }
                    @media print {
                        .no-print, .card, .page-title { display: none !important; }
                        .sidebar, .topbar, header { display: none !important; }
                        #root, body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
                        main { margin: 0 !important; padding: 20px !important; width: 100% !important; max-width: 100% !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .print-only { 
                            display: block !important; color: black !important; font-family: "Times New Roman", Times, serif; 
                            font-size: 14px; position: absolute; left: 0; top: 0; width: 100vw; padding: 20px; box-sizing: border-box; 
                        }
                        .moc-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px; }
                        .moc-tbl td { border: 1px solid #000; padding: 8px; vertical-align: top; }
                        .hdr { font-weight: bold; background: #f0f0f0 !important; }
                        .chk { display: inline-block; width: 14px; height: 14px; border: 1px solid #000; margin-right: 6px; vertical-align: bottom; }
                        .chk.chk-y { background: #000; }
                    }
                `}
            </style>
            
            <div className="page-title no-print">🔄 Management of Change (MoC) — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Search / Enter MoC Number</label>
                        <input className="form-input" placeholder="e.g. MOC-2026-001" value={mocNo} onChange={e => { setMocNo(e.target.value); setMsg(null) }} />
                    </div>
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

            {mocNo && (
                <>
                    <div className="card no-print">
                        <div className="card-hdr" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
                            MODIFICATION PROPOSAL INITIATION FORM
                        </div>
                        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: 16 }}>
                            <F label="Initiation Date" name="initiation_date" type="date" form={form} onChange={onChange} />
                            <F label="Equipment / Process / System involved" name="system_involved" form={form} onChange={onChange} />
                            <F label="Location / KKS" name="kks" form={form} onChange={onChange} />
                            <F label="Reference document" name="ref_doc" form={form} onChange={onChange} />
                            
                            <TA label="Purpose / Object of this modification" name="purpose" form={form} onChange={onChange} />
                            <TA label="Present condition" name="present_condition" form={form} onChange={onChange} />
                            <TA label="Proposed modification" name="proposed_modification" form={form} onChange={onChange} />
                            
                            <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
                                    <div>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>Process control / Critical device</div>
                                        <Radio name="criticality" value="Non Critical" label="Non Critical" />
                                        <Radio name="criticality" value="Critical" label="Critical" />
                                    </div>
                                    <div>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>Category of Change</div>
                                        <Radio name="category" value="Emergency" label="Emergency" />
                                        <Radio name="category" value="Temporary" label="Temporary" />
                                        <Radio name="category" value="Permanent" label="Permanent" />
                                    </div>
                                    <div>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>HAZOP Study</div>
                                        <Radio name="hazop" value="Applicable" label="Applicable" />
                                        <Radio name="hazop" value="Not Applicable" label="Not Applicable" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                <div style={{fontWeight:'bold', marginBottom: 12}}>Initiation & Approvals</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                    <div style={{border: '1px solid var(--border)', padding: 12, borderRadius: 6}}>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>INITIATOR</div>
                                        <input className="form-input" placeholder="Name" style={{marginBottom: 8}} name="initiator_name" value={form.initiator_name||''} onChange={onChange} />
                                        <input className="form-input" placeholder="Signature & Date" name="initiator_sign" value={form.initiator_sign||''} onChange={onChange} />
                                    </div>
                                    <div style={{border: '1px solid var(--border)', padding: 12, borderRadius: 6}}>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>EXECUTOR</div>
                                        <input className="form-input" placeholder="Name" style={{marginBottom: 8}} name="executor_name" value={form.executor_name||''} onChange={onChange} />
                                        <input className="form-input" placeholder="Signature & Date" name="executor_sign" value={form.executor_sign||''} onChange={onChange} />
                                    </div>
                                    <div style={{border: '1px solid var(--border)', padding: 12, borderRadius: 6}}>
                                        <div style={{fontWeight:'bold', marginBottom: 8}}>ACCEPTED BY (MTP/O&E)</div>
                                        <input className="form-input" placeholder="Name" style={{marginBottom: 8}} name="acceptor_name" value={form.acceptor_name||''} onChange={onChange} />
                                        <input className="form-input" placeholder="Signature & Date" name="acceptor_sign" value={form.acceptor_sign||''} onChange={onChange} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                        <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Form</button>
                        <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Data'}
                        </button>
                    </div>

                    <div className="print-only">
                        <table className="moc-tbl">
                            <tbody>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                                        {selectedPlant?.full_name?.toUpperCase() || 'MEIL NEYVELI ENERGY PRIVATE LIMITED'}<br/>
                                        <span style={{ fontSize: '14px', fontWeight: 'normal' }}>
                                            {selectedPlant?.location || '250 MW LFPP, Uthangal, Vridhachalam, Tamil Nadu – 607 804'}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold', background: '#f0f0f0', fontSize: '16px' }}>
                                        MODIFICATION PROPOSAL FORM
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{width: '50%'}}><span style={{fontWeight:'bold'}}>MP No:</span> {mocNo}</td>
                                    <td><span style={{fontWeight:'bold'}}>Initiation Date:</span> {form.initiation_date}</td>
                                </tr>
                                <tr>
                                    <td><span style={{fontWeight:'bold'}}>Equipment/Process/System involved:</span><br/>{form.system_involved}</td>
                                    <td><span style={{fontWeight:'bold'}}>Location / KKS:</span><br/>{form.kks}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2}><span style={{fontWeight:'bold'}}>Reference document:</span> {form.ref_doc}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>
                                        <span style={{fontWeight:'bold'}}>Purpose/Object of this modification:</span><br/>
                                        <div style={{minHeight: '60px', marginTop: 4}}>{form.purpose}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>
                                        <span style={{fontWeight:'bold'}}>Present condition:</span><br/>
                                        <div style={{minHeight: '60px', marginTop: 4}}>{form.present_condition}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>
                                        <span style={{fontWeight:'bold'}}>Proposed modification:</span><br/>
                                        <div style={{minHeight: '60px', marginTop: 4}}>{form.proposed_modification}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span style={{fontWeight:'bold'}}>Process control / Critical device</span><br/><br/>
                                        <span className={`chk ${form.criticality === 'Non Critical' ? 'chk-y' : ''}`}></span> Non Critical &nbsp;&nbsp;&nbsp;
                                        <span className={`chk ${form.criticality === 'Critical' ? 'chk-y' : ''}`}></span> Critical
                                    </td>
                                    <td>
                                        <span style={{fontWeight:'bold'}}>Category of Change</span><br/><br/>
                                        <span className={`chk ${form.category === 'Emergency' ? 'chk-y' : ''}`}></span> Emergency &nbsp;&nbsp;&nbsp;
                                        <span className={`chk ${form.category === 'Temporary' ? 'chk-y' : ''}`}></span> Temporary &nbsp;&nbsp;&nbsp;
                                        <span className={`chk ${form.category === 'Permanent' ? 'chk-y' : ''}`}></span> Permanent
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>
                                        <span style={{fontWeight:'bold'}}>HAZARD & OPERABILITY (HAZOP) STUDY</span><br/><br/>
                                        <span className={`chk ${form.hazop === 'Applicable' ? 'chk-y' : ''}`}></span> Applicable &nbsp;&nbsp;&nbsp;
                                        <span className={`chk ${form.hazop === 'Not Applicable' ? 'chk-y' : ''}`}></span> Not Applicable
                                        <br/><br/>
                                        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 8}}>
                                            <tbody>
                                                <tr>
                                                    <td style={{border: 'none', padding: 0}}>Dept:</td>
                                                    <td style={{border: 'none', padding: 0}}>Opn/Mtce/User</td>
                                                    <td style={{border: 'none', padding: 0}}>Design</td>
                                                    <td style={{border: 'none', padding: 0}}>Safety Engineer</td>
                                                    <td style={{border: 'none', padding: 0}}>Environment Engineer</td>
                                                </tr>
                                                <tr>
                                                    <td style={{border: 'none', padding: 0}}>Name/Sign/Date:</td>
                                                    <td style={{border: 'none', padding: 0, borderBottom: '1px dashed #000'}}></td>
                                                    <td style={{border: 'none', padding: 0, borderBottom: '1px dashed #000'}}></td>
                                                    <td style={{border: 'none', padding: 0, borderBottom: '1px dashed #000'}}></td>
                                                    <td style={{border: 'none', padding: 0, borderBottom: '1px dashed #000'}}></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{padding: 0, border: 'none'}}>
                                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                            <tbody>
                                                <tr>
                                                    <td style={{width: '33.33%', borderTop: 'none', borderLeft: 'none', borderBottom: 'none'}}>
                                                        <div style={{fontWeight:'bold', marginBottom: 12}}>INITIATOR</div>
                                                        Name: {form.initiator_name}<br/>
                                                        Sign/Date: {form.initiator_sign}
                                                    </td>
                                                    <td style={{width: '33.33%', borderTop: 'none', borderBottom: 'none'}}>
                                                        <div style={{fontWeight:'bold', marginBottom: 12}}>EXECUTOR</div>
                                                        Name: {form.executor_name}<br/>
                                                        Sign/Date: {form.executor_sign}
                                                    </td>
                                                    <td style={{width: '33.33%', borderTop: 'none', borderRight: 'none', borderBottom: 'none'}}>
                                                        <div style={{fontWeight:'bold', marginBottom: 12}}>ACCEPTED BY MTP/O&E</div>
                                                        Name: {form.acceptor_name}<br/>
                                                        Sign/Date: {form.acceptor_sign}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}
