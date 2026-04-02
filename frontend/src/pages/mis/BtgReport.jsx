import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const F = ({ label, name, type="number", form, onChange, defaultDesign }) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
        <input className="form-input" type={type} name={name} value={form[name] ?? ''} onChange={onChange} style={{ textAlign: 'right' }} />
    </div>
)

export default function BtgReport() {
    const { selectedPlant } = usePlant()
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [form, setForm] = useState({})
    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()
    const plantId = selectedPlant?.id

    const { data: currentRes, isFetching } = useQuery({
        queryKey: ['mis-btg', plantId, date],
        queryFn: () => dataEntry.getMisBtg(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    useEffect(() => {
        setForm({
            // default design params if not saved
            design_station_ghr: 2601.77, design_boiler_eff: 74.51, design_turbine_hr: 1935.92,
            design_station_nhr: 2824.33, design_plant_eff: 33.05, design_raph1: 57.62,
            design_raph2: 57.62, design_condenser: 81.33, design_cooling: 71.25,
            design_flue_gas: 150.2, design_vacuum: 101, design_ms_temp: 536,
            design_hr_temp: 537, design_makeup: 3.5
        })
        setMsg(null)
    }, [date, plantId])

    useEffect(() => {
        if (isFetching) return
        const row = currentRes?.data?.data ?? {}
        if (row.id) {
            setForm(prev => ({ ...prev, ...row.data }))
            setMsg({ type: 'info', text: `📂 Loaded saved data for ${date}` })
        }
    }, [currentRes, isFetching])

    const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const saveMutation = useMutation({
        mutationFn: () => dataEntry.saveMisBtg({ plantId, entryDate: date, data: form }),
        onSuccess: async () => {
            setMsg({ type: 'success', text: '✅ BTG Performance Report saved.' })
            await qc.invalidateQueries({ queryKey: ['mis-btg', plantId, date] })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    // Computed deviations
    const c = (design, actual, invert=false) => {
        if (!actual) return ''
        const val = Number(actual) - Number(design)
        return (invert ? -val : val).toFixed(2)
    }

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
                        .print-only { display: block !important; color: black !important; font-family: "Calibri", sans-serif; font-size: 13px; position: absolute; left: 0; top: 0; width: 100vw; padding: 20px; box-sizing: border-box; }
                        
                        .excel-tbl { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 20px; }
                        .excel-tbl th, .excel-tbl td { border: 1px solid #000; padding: 4px; text-align: center; }
                        .excel-tbl th { background: #f0f0f0 !important; font-weight: bold; }
                        .left-align { text-align: left !important; }
                        .right-align { text-align: right !important; }
                    }
                    .btg-table th { background: var(--bg); padding: 12px; border-bottom: 2px solid var(--border); font-size: 12px; }
                    .btg-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                `}
            </style>
            
            <div className="page-title no-print">🔥 Heat-rate report (BTG losses) — {selectedPlant?.short_name}</div>

            <div className="card no-print" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Report Date</label>
                        <input className="form-input" type="date" value={date} onChange={e => { setDate(e.target.value); setMsg(null) }} max={today} />
                    </div>
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type} no-print`}>{msg.text}</div>}

            <div className="card no-print">
                <div className="card-hdr" style={{ fontWeight: 700, fontSize: '1.2rem', textAlign: 'center' }}>
                    PERFORMANCE LOSSES DATA ENTRY
                </div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }} className="btg-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th style={{textAlign:'left'}}>Descriptions</th>
                                <th>Unit</th>
                                <th>Design/Acceptance</th>
                                <th>Actual</th>
                                <th>Variance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>1</td><td className="left-align">Station Gross Heat Rate</td><td>kcal/kWh</td><td>{form.design_station_ghr}</td><td><F name="act_station_ghr" form={form} onChange={onChange}/></td><td>{c(form.design_station_ghr, form.act_station_ghr)}</td></tr>
                            <tr><td>2</td><td className="left-align">Boiler efficiency</td><td>%</td><td>{form.design_boiler_eff}</td><td><F name="act_boiler_eff" form={form} onChange={onChange}/></td><td>{c(form.design_boiler_eff, form.act_boiler_eff)}</td></tr>
                            <tr><td>3</td><td className="left-align">Turbine Heat rate</td><td>kcal/kWh</td><td>{form.design_turbine_hr}</td><td><F name="act_turbine_hr" form={form} onChange={onChange}/></td><td>{c(form.design_turbine_hr, form.act_turbine_hr)}</td></tr>
                            <tr><td>4</td><td className="left-align">Station Net heat rate</td><td>kcal/kWh</td><td>{form.design_station_nhr}</td><td><F name="act_station_nhr" form={form} onChange={onChange}/></td><td>{c(form.design_station_nhr, form.act_station_nhr)}</td></tr>
                            <tr><td>5</td><td className="left-align">Plant overall efficiency</td><td>%</td><td>{form.design_plant_eff}</td><td><F name="act_plant_eff" form={form} onChange={onChange}/></td><td>{c(form.design_plant_eff, form.act_plant_eff)}</td></tr>
                            <tr><td>6</td><td className="left-align">RAPH # 1 Performance</td><td>%</td><td>{form.design_raph1}</td><td><F name="act_raph1" form={form} onChange={onChange}/></td><td>{c(form.design_raph1, form.act_raph1)}</td></tr>
                            <tr><td>7</td><td className="left-align">RAPH # 2 Performance</td><td>%</td><td>{form.design_raph2}</td><td><F name="act_raph2" form={form} onChange={onChange}/></td><td>{c(form.design_raph2, form.act_raph2)}</td></tr>
                            <tr><td>8</td><td className="left-align">Condenser Effectiveness</td><td>%</td><td>{form.design_condenser}</td><td><F name="act_condenser" form={form} onChange={onChange}/></td><td>{c(form.design_condenser, form.act_condenser)}</td></tr>
                            <tr><td>9</td><td className="left-align">Cooling Tower Effectiveness</td><td>%</td><td>{form.design_cooling}</td><td><F name="act_cooling" form={form} onChange={onChange}/></td><td>{c(form.design_cooling, form.act_cooling)}</td></tr>
                            
                            <tr><td colSpan={6} style={{background: 'var(--bg)', fontWeight: 'bold', textAlign: 'center'}}>Impact of parameters on HR</td></tr>
                            <tr><td>1</td><td className="left-align">Flue gas temp at RAPH exit</td><td>°C</td><td>{form.design_flue_gas}</td><td><F name="act_flue_gas" form={form} onChange={onChange}/></td><td>{c(form.design_flue_gas, form.act_flue_gas)}</td></tr>
                            <tr><td>2</td><td className="left-align">Condenser vacuum</td><td>mbar</td><td>{form.design_vacuum}</td><td><F name="act_vacuum" form={form} onChange={onChange}/></td><td>{c(form.design_vacuum, form.act_vacuum)}</td></tr>
                            <tr><td>3</td><td className="left-align">Main steam temp</td><td>°C</td><td>{form.design_ms_temp}</td><td><F name="act_ms_temp" form={form} onChange={onChange}/></td><td>{c(form.design_ms_temp, form.act_ms_temp)}</td></tr>
                            <tr><td>4</td><td className="left-align">Hot reheat temp</td><td>°C</td><td>{form.design_hr_temp}</td><td><F name="act_hr_temp" form={form} onChange={onChange}/></td><td>{c(form.design_hr_temp, form.act_hr_temp)}</td></tr>
                            <tr><td>5</td><td className="left-align">Excess water makeup losses</td><td>t/hr</td><td>{form.design_makeup}</td><td><F name="act_makeup" form={form} onChange={onChange}/></td><td>{c(form.design_makeup, form.act_makeup)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Print Final Template</button>
                <button className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Data'}
                </button>
            </div>

            <div className="print-only">
                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
                    {selectedPlant?.short_name || 'TAQA Neyveli Power Company Pvt. Ltd.'}<br/>
                    <span style={{ fontSize: '14px', fontWeight: 'normal' }}>250 MW LFPP, Uthangal, Cuddalore Dist, Tamil Nadu - 607 804.</span>
                </div>

                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>HR Test Deviations - {date.split('-').reverse().join('-')}</div>
                <table className="excel-tbl">
                    <thead>
                        <tr>
                            <th style={{width: '5%'}}>S No</th>
                            <th style={{width: '35%'}}>Descriptions</th>
                            <th style={{width: '15%'}}>Unit</th>
                            <th style={{width: '15%'}}>As per design</th>
                            <th style={{width: '15%'}}>Actual</th>
                            <th style={{width: '15%'}}>Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td><td className="left-align">Station Gross Heat Rate</td><td>kcal/kWh</td><td>{form.design_station_ghr}</td><td>{form.act_station_ghr}</td><td>{c(form.design_station_ghr, form.act_station_ghr)}</td></tr>
                        <tr><td>2</td><td className="left-align">Boiler efficiency</td><td>%</td><td>{form.design_boiler_eff}</td><td>{form.act_boiler_eff}</td><td>{c(form.design_boiler_eff, form.act_boiler_eff)}</td></tr>
                        <tr><td>3</td><td className="left-align">Turbine Heat rate</td><td>kcal/kWh</td><td>{form.design_turbine_hr}</td><td>{form.act_turbine_hr}</td><td>{c(form.design_turbine_hr, form.act_turbine_hr)}</td></tr>
                        <tr><td>4</td><td className="left-align">Station Net heat rate</td><td>kcal/kWh</td><td>{form.design_station_nhr}</td><td>{form.act_station_nhr}</td><td>{c(form.design_station_nhr, form.act_station_nhr)}</td></tr>
                        <tr><td>5</td><td className="left-align">Plant overall efficiency</td><td>%</td><td>{form.design_plant_eff}</td><td>{form.act_plant_eff}</td><td>{c(form.design_plant_eff, form.act_plant_eff)}</td></tr>
                        <tr><td>6</td><td className="left-align">RAPH # 1 Performance</td><td>%</td><td>{form.design_raph1}</td><td>{form.act_raph1}</td><td>{c(form.design_raph1, form.act_raph1)}</td></tr>
                        <tr><td>7</td><td className="left-align">RAPH # 2 Performance</td><td>%</td><td>{form.design_raph2}</td><td>{form.act_raph2}</td><td>{c(form.design_raph2, form.act_raph2)}</td></tr>
                        <tr><td>8</td><td className="left-align">Condenser Effectiveness</td><td>%</td><td>{form.design_condenser}</td><td>{form.act_condenser}</td><td>{c(form.design_condenser, form.act_condenser)}</td></tr>
                        <tr><td>9</td><td className="left-align">Cooling Tower Effectiveness</td><td>%</td><td>{form.design_cooling}</td><td>{form.act_cooling}</td><td>{c(form.design_cooling, form.act_cooling)}</td></tr>
                    </tbody>
                </table>

                <div style={{ fontWeight: 'bold', marginBottom: '8px', marginTop: '30px' }}>Impact of parameters on HR</div>
                <table className="excel-tbl">
                    <thead>
                        <tr>
                            <th style={{width: '5%'}}>S No</th>
                            <th style={{width: '35%'}}>Descriptions</th>
                            <th style={{width: '15%'}}>Unit</th>
                            <th style={{width: '15%'}}>As per design</th>
                            <th style={{width: '15%'}}>Actual</th>
                            <th style={{width: '15%'}}>Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td><td className="left-align">Flue gas temp at RAPH exit</td><td>°C</td><td>{form.design_flue_gas}</td><td>{form.act_flue_gas}</td><td>{c(form.design_flue_gas, form.act_flue_gas)}</td></tr>
                        <tr><td>2</td><td className="left-align">Condenser vacuum</td><td>mbar</td><td>{form.design_vacuum}</td><td>{form.act_vacuum}</td><td>{c(form.design_vacuum, form.act_vacuum)}</td></tr>
                        <tr><td>3</td><td className="left-align">Main steam temp</td><td>°C</td><td>{form.design_ms_temp}</td><td>{form.act_ms_temp}</td><td>{c(form.design_ms_temp, form.act_ms_temp)}</td></tr>
                        <tr><td>4</td><td className="left-align">Hot reheat temp</td><td>°C</td><td>{form.design_hr_temp}</td><td>{form.act_hr_temp}</td><td>{c(form.design_hr_temp, form.act_hr_temp)}</td></tr>
                        <tr><td>5</td><td className="left-align">Excess water makeup losses</td><td>t/hr</td><td>{form.design_makeup}</td><td>{form.act_makeup}</td><td>{c(form.design_makeup, form.act_makeup)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
