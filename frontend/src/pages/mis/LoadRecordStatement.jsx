import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const F = ({ label, name, type="text", form, onChange }) => (
    <div className="form-group">
        <label className="form-label" style={{fontWeight: 'bold', fontSize: 12}}>{label}</label>
        <input className="form-input" type={type} name={name} value={form[name] ?? ''} onChange={onChange} />
    </div>
)

export default function LoadRecordStatement() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    // using month representation e.g. YYYY-MM based on the first day
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({ intervals: {} })
    const [msg, setMsg] = useState(null)
    const [activeTab, setActiveTab] = useState('summary')
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-load', plantId, date],
        queryFn: () => dataEntry.getMisLoadRecord(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    useEffect(() => {
        setForm({ intervals: {} })
        setMsg(null)
    }, [date, plantId])

    useEffect(() => {
        if (isFetching) return
        const row = currentRes?.data?.data ?? {}
        if (row.id) {
            setForm(row.data)
            setMsg({ type: 'info', text: `📂 Loaded saved load record data` })
        }
    }, [currentRes, isFetching])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    
    // update a specific cell in the 96 interval matrix
    const onIntervalChange = (idx, field, val) => {
        setForm(f => ({
            ...f,
            intervals: {
                ...f.intervals,
                [idx]: { ...(f.intervals?.[idx] || {}), [field]: val }
            }
        }))
    }

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveMisLoadRecord({ plantId, entryDate: date, data: form }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ Load Record saved.' })
            await qc.invalidateQueries({ queryKey: ['mis-load', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    const timeBlocks = Array.from({length: 96}, (_, i) => {
        const h1 = String(Math.floor(i * 15 / 60)).padStart(2, '0')
        const m1 = String((i * 15) % 60).padStart(2, '0')
        const h2 = String(Math.floor((i + 1) * 15 / 60)).padStart(2, '0')
        const m2 = String(((i + 1) * 15) % 60).padStart(2, '0')
        return `${h1}:${m1} / ${h2 === '24' ? '00' : h2}:${m2}`
    })

    return (
        <div style={{ paddingBottom: 40 }} className="incident-container">
            <style>
                {`
                    .print-only { display: none; }
                    @media print {
                        .no-print, .card, .page-title, .page-sub, .tabs { display: none !important; }
                        .sidebar, .topbar { display: none !important; }
                        header { display: none !important; }
                        #root, body, html { margin: 0 !important; padding: 0 !important; background: white !important; }
                        main { margin: 0 !important; padding: 20px !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        
                        .incident-container { position: absolute; left: 0; top: 0; width: 100vw; }
                        .print-only { display: block !important; color: black !important; font-family: "Times New Roman", Times, serif; font-size: 13px; margin: 0; padding: 20px; box-sizing: border-box; }
                        
                        .excel-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px; page-break-inside: auto; }
                        .excel-tbl tr { page-break-inside: avoid; page-break-after: auto; }
                        .excel-tbl th, .excel-tbl td { border: 1px solid #000; padding: 4px; }
                        .excel-tbl th { background: #f0f0f0 !important; font-weight: bold; text-align: center; }
                        
                        .page-break { page-break-before: always; }
                    }
                    
                    .tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
                    .tab { padding: 8px 16px; cursor: pointer; border-radius: 6px; font-weight: 500; font-size: 14px; transition: background 0.2s; }
                    .tab:hover { background: rgba(255,255,255,0.05); }
                    .tab.active { background: var(--primary); color: white; }
                    
                    .grid-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .grid-tbl th { background: var(--bg); padding: 8px; text-align: left; border-bottom: 2px solid var(--border); position: sticky; top: 0; z-index: 10; }
                    .grid-tbl td { padding: 4px; border-bottom: 1px solid var(--border); }
                    .grid-tbl input { width: 100%; background: transparent; border: 1px solid var(--border); color: var(--text); padding: 4px; border-radius: 4px; }
                    .grid-tbl input:focus { border-color: var(--primary); outline: none; }
                `}
            </style>
            
            <div className="page-title no-print">📊 Load Record Statement — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Select Date / Month</label>
                        <input className="form-input" type="date" value={date} onChange={e => { setDate(e.target.value); setMsg(null) }} />
                    </div>
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

            <div className="card no-print">
                <div className="card-body">
                    <div className="tabs">
                        <div className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary Metrics</div>
                        <div className={`tab ${activeTab === 'intervals' ? 'active' : ''}`} onClick={() => setActiveTab('intervals')}>15-Min Intervals</div>
                    </div>

                    {activeTab === 'summary' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr)', gap: '16px' }}>
                            <F label="Total Units Generated (kWh)" name="total_generated" form={form} onChange={onChange} />
                            <F label="Auxiliary Source Consumption" name="aux_consumption" form={form} onChange={onChange} />
                            <F label="External Source Consumption" name="ext_consumption" form={form} onChange={onChange} />
                            <F label="Units Exported" name="units_exported" form={form} onChange={onChange} />
                            <F label="Units Imported" name="units_imported" form={form} onChange={onChange} />
                            <F label="Net Units Exported" name="net_exported" form={form} onChange={onChange} />
                            
                            <F label="Total Running Hours (Station)" name="running_hours" form={form} onChange={onChange} />
                            <F label="Forced Outage Hours" name="forced_outage" form={form} onChange={onChange} />
                            <F label="Planned Outage Hours" name="planned_outage" form={form} onChange={onChange} />
                            
                            <F label="Peak Instantaneous Load (MW)" name="peak_load" form={form} onChange={onChange} />
                            <F label="MIN Load (MW)" name="min_load" form={form} onChange={onChange} />
                            
                            <F label="Availability Factor (%)" name="availability_factor" form={form} onChange={onChange} />
                            <F label="Capacity Factor (%)" name="capacity_factor" form={form} onChange={onChange} />
                            <F label="Reduction in Generation (Backdown)" name="reduction_gen" form={form} onChange={onChange} />
                        </div>
                    )}

                    {activeTab === 'intervals' && (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <table className="grid-tbl">
                                <thead>
                                    <tr>
                                        <th style={{width: '60px'}}>#</th>
                                        <th style={{width: '120px'}}>Time Period</th>
                                        <th>Declared Capacity MW</th>
                                        <th>Dispatch Demand MWh</th>
                                        <th>Generation MWh</th>
                                        <th>Load change / DSM note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeBlocks.map((time, i) => {
                                        const r = form.intervals?.[i] || {}
                                        return (
                                            <tr key={i}>
                                                <td>{i+1}</td>
                                                <td>{time}</td>
                                                <td><input value={r.capacity || ''} onChange={e => onIntervalChange(i, 'capacity', e.target.value)} /></td>
                                                <td><input value={r.demand || ''} onChange={e => onIntervalChange(i, 'demand', e.target.value)} /></td>
                                                <td><input value={r.generation || ''} onChange={e => onIntervalChange(i, 'generation', e.target.value)} /></td>
                                                <td><input value={r.dsm || ''} onChange={e => onIntervalChange(i, 'dsm', e.target.value)} /></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Record Statement</button>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Data'}
                </button>
            </div>

            <div className="print-only">
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '20px' }}>
                    MONTHLY LOAD RECORD STATEMENT<br/>
                    <span style={{ fontSize: '14px', fontWeight: 'normal' }}>from 00:00 hrs on 1st day to 24:00hrs on last day</span>
                </div>
                
                <table className="excel-tbl" style={{ marginBottom: '40px' }}>
                    <tbody>
                        <tr><td>1</td><td style={{fontWeight:'bold'}}>Name of the Station</td><td>: TAQA Neyveli Power Company Pvt. Ltd.</td></tr>
                        <tr><td>2</td><td style={{fontWeight:'bold'}}>Total units generated (Kwh)</td><td>: {form.total_generated}</td></tr>
                        <tr><td>3</td><td style={{fontWeight:'bold'}}>Station consumption from own source</td><td>: {form.aux_consumption}</td></tr>
                        <tr><td>4</td><td style={{fontWeight:'bold'}}>Station consumption external source</td><td>: {form.ext_consumption}</td></tr>
                        <tr><td>5</td><td style={{fontWeight:'bold'}}>Units exported</td><td>: {form.units_exported}</td></tr>
                        <tr><td>6</td><td style={{fontWeight:'bold'}}>Units imported</td><td>: {form.units_imported}</td></tr>
                        <tr><td>7</td><td style={{fontWeight:'bold'}}>Net units exported</td><td>: {form.net_exported}</td></tr>
                        <tr><td>8</td><td style={{fontWeight:'bold'}}>Total running hours of the Station</td><td>: {form.running_hours}</td></tr>
                        <tr><td>9</td><td style={{fontWeight:'bold'}}>Forced Outage hours of the Station</td><td>: {form.forced_outage}</td></tr>
                        <tr><td>10</td><td style={{fontWeight:'bold'}}>Planned Outage hours for the station</td><td>: {form.planned_outage}</td></tr>
                        <tr><td>11</td><td style={{fontWeight:'bold'}}>Station peak instantaneous MW</td><td>: {form.peak_load}</td></tr>
                        <tr><td>12</td><td style={{fontWeight:'bold'}}>Station MIN Load in MW</td><td>: {form.min_load}</td></tr>
                        <tr><td>13</td><td style={{fontWeight:'bold'}}>Availability Factor</td><td>: {form.availability_factor}</td></tr>
                        <tr><td>14</td><td style={{fontWeight:'bold'}}>Station Capacity Factor</td><td>: {form.capacity_factor}</td></tr>
                        <tr><td>15</td><td style={{fontWeight:'bold'}}>Reduction in Generation (Backdown)</td><td>: {form.reduction_gen}</td></tr>
                    </tbody>
                </table>
                
                <div className="page-break" />
                
                <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>15-Minute Block Distribution - {date}</div>
                <table className="excel-tbl">
                    <thead>
                        <tr>
                            <th>Period</th>
                            <th>Time Block</th>
                            <th>Declared Cap MW</th>
                            <th>Dispatch Dem MWh</th>
                            <th>Generation MWh</th>
                            <th>Deemed MWh</th>
                            <th>Load change / DSM note</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeBlocks.map((time, i) => {
                            const r = form.intervals?.[i] || {}
                            const deemed = (Number(r.demand||0) - Number(r.generation||0))
                            return (
                                <tr key={i}>
                                    <td style={{textAlign:'center'}}>{i+1}</td>
                                    <td style={{textAlign:'center'}}>{time}</td>
                                    <td style={{textAlign:'right'}}>{r.capacity}</td>
                                    <td style={{textAlign:'right'}}>{r.demand}</td>
                                    <td style={{textAlign:'right'}}>{r.generation}</td>
                                    <td style={{textAlign:'right'}}>{deemed !== 0 && !isNaN(deemed) ? deemed.toFixed(1) : ''}</td>
                                    <td>{r.dsm}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
