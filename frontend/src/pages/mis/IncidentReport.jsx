import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const F = ({ label, name, type="text", form, onChange }) => (
    <div className="form-group">
        <label className="form-label" style={{fontWeight: 'bold'}}>{label}</label>
        {type === 'textarea' ? (
            <textarea className="form-input" name={name} value={form[name] ?? ''} onChange={onChange} rows={4} />
        ) : (
            <input className="form-input" type={type} name={name} value={form[name] ?? ''} onChange={onChange} />
        )}
    </div>
)

export default function IncidentReport() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-incident', plantId, date],
        queryFn: () => dataEntry.getMisIncident(plantId, date),
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
            setForm({
                incidentTime: row.incident_time ?? '',
                incidentDesc: row.incident_desc ?? '',
                actionTaken: row.action_taken ?? '',
                shiftChargeEngineer: row.shift_charge_engineer ?? ''
            })
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        } else {
            const formHasData = Object.keys(form).some(k => form[k] !== '' && form[k] !== null)
            if (!formHasData) setForm({})
        }
    }, [currentRes, isFetching, date, plantId])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveMisIncident({
            plantId, entryDate: date, ...form
        }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ Incident Report saved.' })
            await qc.invalidateQueries({ queryKey: ['mis-incident', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    return (
        <div style={{ paddingBottom: 40 }} className="incident-container">
            <style>
                {`
                    .print-only { display: none; }
                    
                    @media print {
                        .no-print, .card, .page-title, .page-sub { display: none !important; }
                        .sidebar, .topbar { display: none !important; }
                        header { display: none !important; }
                        #root, body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
                        main { margin: 0 !important; padding: 20px !important; width: 100% !important; max-width: 100% !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .incident-container { padding: 0 !important; width: 100% !important; background: white !important; margin: 0 !important; border: none !important; }
                        
                        .print-only { display: block !important; color: black !important; font-family: "Times New Roman", Times, serif; font-size: 14px; margin: 0; padding: 0; position: absolute; top: 0; left: 0; width: 100vw; }
                        
                        .print-table { width: 100%; border-collapse: collapse; border: 1px solid #000; table-layout: fixed; }
                        .print-table td, .print-table th { border: 1px solid #000; padding: 6px; text-align: center; }
                        
                        .meil-logo-box { display: flex; align-items: center; justify-content: center; height: 100%; padding: 4px; }
                        .meil-m { color: #E75D53; font-weight: bold; font-family: Arial, sans-serif; font-size: 32px; line-height: 1; border: 2px solid #E75D53; padding: 0 4px; border-radius: 4px; margin-right: 8px; position: relative; }
                        .meil-m-inner { position: absolute; font-size: 10px; bottom: 1px; left: 2px; letter-spacing: -1px; }
                        .meil-word { color: #5885C4; font-weight: bold; font-family: Arial, sans-serif; font-size: 36px; letter-spacing: -1px; }
                        
                        .company-header { font-size: 18px; font-weight: bold; font-family: "Times New Roman", serif; color: #555; }
                        .company-sub { font-size: 16px; font-weight: bold; font-family: "Times New Roman", serif; color: #666; }
                        
                        .meta-title { font-size: 9px; color: #777; font-family: Arial, sans-serif; margin-bottom: 2px; }
                        .meta-val { font-size: 11px; color: #555; font-family: Arial, sans-serif; font-weight: normal; }
                        
                        .content-section { margin-top: 30px; font-family: "Calibri", Arial, sans-serif; line-height: 1.5; font-size: 15px; padding: 0 20px; }
                        .content-bold { font-weight: bold; }
                    }
                `}
            </style>
            
            <div className="page-title no-print">📝 Incident Report — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Entry Date</label>
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

            <div className="card no-print">
                <div className="card-hdr" style={{ fontWeight: 700, fontSize: '1.2rem', textAlign: 'center' }}>
                    INCIDENT REPORT DATA ENTRY
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                        <div style={{ flex: 1 }}><strong>Date:</strong> {date}</div>
                        <div style={{ flex: 1 }}><strong>Plant:</strong> {selectedPlant?.name}</div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                        <F label="Time of Incident" name="incidentTime" type="time" form={form} onChange={onChange} />
                        <F label="Incident Details" name="incidentDesc" type="textarea" form={form} onChange={onChange} />
                        <F label="Action Taken" name="actionTaken" type="textarea" form={form} onChange={onChange} />
                        <F label="Shift Charge Engineer" name="shiftChargeEngineer" form={form} onChange={onChange} />
                    </div>
                </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Final Template</button>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Data'}
                </button>
            </div>

            {/* PERFECT PRINT VIEW AS REQUESTED */}
            <div className="print-only">
                <table className="print-table">
                    <tbody>
                        <tr>
                            <td style={{ width: '25%', height: '80px', padding: 0 }}>
                                <div className="meil-logo-box">
                                    <div className="meil-m">
                                        M
                                        <div className="meil-m-inner">E O E</div>
                                    </div>
                                    <div className="meil-word">meil</div>
                                </div>
                            </td>
                            <td style={{ width: '75%', padding: '10px' }}>
                                <div className="company-header">MEIL Neyveli Energy Private Limited</div>
                                <div className="company-sub">250 MW Power Plant</div>
                                <div className="company-sub">Uthangal, Vridhachalam, TamilNadu – 607 804</div>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} style={{ fontSize: '18px', fontWeight: 'bold', color: '#777', padding: '6px', letterSpacing: '1px' }}>
                                INCIDENT REPORT
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <table className="print-table" style={{ marginTop: '-1px' }}>
                    <tbody>
                        <tr>
                            <td style={{width: '20%'}}>
                                <div className="meta-title">Responsible Person</div>
                                <div className="meta-val">SHIFTMANAGER</div>
                            </td>
                            <td style={{width: '20%'}}>
                                <div className="meta-title">Revision No:</div>
                                <div className="meta-val">2</div>
                            </td>
                            <td style={{width: '20%'}}>
                                <div className="meta-title">Revision Date:</div>
                                <div className="meta-val">14.10.2020</div>
                            </td>
                            <td style={{width: '20%'}}>
                                <div className="meta-title">File No.</div>
                                <div className="meta-val">Reports</div>
                            </td>
                            <td style={{width: '20%'}}>
                                <div className="meta-title">Page</div>
                                <div className="meta-val">1</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="content-section">
                    <div style={{ fontWeight: 'bold', marginBottom: '30px', fontSize: '16px' }}>
                        IR {date.split('-')[1]}/{date.split('-')[0]}
                    </div>
                    
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '50px' }}>
                        INCIDENT REPORT on: {date.split('-').reverse().join('.')}
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <span className="content-bold">Date & Time: </span> 
                        {date.split('-').reverse().join('.')}, {form.incidentTime || '___:___'} hrs.
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <div className="content-bold" style={{ marginBottom: '8px' }}>Incident:</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{form.incidentDesc}</div>
                    </div>

                    <div style={{ marginBottom: '60px' }}>
                        <div className="content-bold" style={{ marginBottom: '8px' }}>Action Taken:</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{form.actionTaken}</div>
                    </div>

                    <div style={{ marginTop: '80px' }}>
                        <div className="content-bold">{form.shiftChargeEngineer || '_________________________'}</div>
                        <div>Shift Charge Engineer</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
