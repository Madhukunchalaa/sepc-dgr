// src/pages/data-entry/SEPCExcelUpload.jsx
// Upload SEPC TTPP DGR Excel → auto-extract all modules → save & submit in one click
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

const fmt = (v, d = 3) => (v == null || isNaN(v) ? '—' : Number(v).toFixed(d))

const Tag = ({ ok }) => (
    <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
        background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#16a34a' : '#dc2626',
    }}>
        {ok ? '✓ Found' : '✗ Not found'}
    </span>
)

const Row = ({ label, value, unit }) => (
    <tr>
        <td style={{ color: 'var(--muted)', fontSize: 12, paddingRight: 12 }}>{label}</td>
        <td className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>{value}</td>
        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{unit}</td>
    </tr>
)

export default function SEPCExcelUpload() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)
    const [file, setFile] = useState(null)
    const [dragover, setDragover] = useState(false)
    const [preview, setPreview] = useState(null)
    const [msg, setMsg] = useState(null)
    const fileRef = useRef()

    const isTTPP = selectedPlant?.short_name === 'TTPP' || selectedPlant?.short_name === 'SEPC'

    const buildFormData = (pOnly) => {
        const fd = new FormData()
        fd.append('dgrFile', file)
        fd.append('entryDate', date)
        if (pOnly) fd.append('previewOnly', 'true')
        return fd
    }

    // Preview only — shows extracted values before saving
    const previewMutation = useMutation({
        mutationFn: () => dataEntry.uploadSEPCExcel(plantId, buildFormData(true)),
        onSuccess: (res) => {
            setPreview(res.data.data.preview)
            setMsg({ type: 'info', text: '👁 Preview extracted — review and confirm to save.' })
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Preview failed' }),
    })

    // Save — actually writes all modules to DB
    const saveMutation = useMutation({
        mutationFn: () => dataEntry.uploadSEPCExcel(plantId, buildFormData(false)),
        onSuccess: (res) => {
            setMsg({ type: 'success', text: `✅ ${res.data.data.message}` })
            setPreview(res.data.data.extracted)
        },
        onError: (e) => setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed' }),
    })

    const handleFile = (f) => {
        if (!f) return
        setFile(f)
        setPreview(null)
        setMsg(null)
    }

    const p = preview

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-title">📤 SEPC Excel Import</div>
            <div className="page-sub">Upload DGR FY Excel — all modules extracted & saved automatically</div>

            {/* Date + plant row */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Entry Date</label>
                        <input className="form-input" type="date" value={date} max={today}
                            onChange={e => { setDate(e.target.value); setPreview(null); setMsg(null) }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Plant: <strong>{selectedPlant?.name || 'None selected'}</strong>
                    </div>
                    {!isTTPP && plantId && (
                        <div style={{ fontSize: 12, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: 6 }}>
                            ⚠️ This upload is designed for SEPC TTPP plant only.
                        </div>
                    )}
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            {!plantId ? (
                <div className="alert alert-info">ℹ Select SEPC TTPP plant from the sidebar to begin.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>

                    {/* Left — upload zone */}
                    <div>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div className="card-hdr"><div className="card-title">📁 DGR Excel File</div></div>
                            <div className="card-body">
                                <div
                                    style={{
                                        border: `2px dashed ${dragover ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: 10, padding: '32px 20px', textAlign: 'center',
                                        cursor: 'pointer', transition: 'border-color .15s',
                                        background: dragover ? 'rgba(37,99,235,0.04)' : 'transparent',
                                    }}
                                    onDragOver={e => { e.preventDefault(); setDragover(true) }}
                                    onDragLeave={() => setDragover(false)}
                                    onDrop={e => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]) }}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        {file ? file.name : 'Drop DGR Excel here or click to browse'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        {file
                                            ? `${(file.size / 1024).toFixed(1)} KB · Click to change`
                                            : 'Supports .xlsx .xlsm · DGR FY 2025-26 format'}
                                    </div>
                                    <input ref={fileRef} type="file" style={{ display: 'none' }}
                                        accept=".xls,.xlsx,.xlsm"
                                        onChange={e => handleFile(e.target.files[0])} />
                                </div>
                            </div>
                        </div>

                        {/* Sheets that will be parsed */}
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div className="card-hdr"><div className="card-title">📋 Sheets Parsed</div></div>
                            <div className="card-body" style={{ padding: '8px 16px' }}>
                                {[
                                    ['Power', 'Generation, meter readings'],
                                    ['Fuel & Ash', 'Coal, LDO, HFO, H₂/CO₂/N₂, ash'],
                                    ['Perf', 'GCV, GHR'],
                                    ['Water', 'DM water, sea water, potable'],
                                    ['Availability', 'PAF%, hours on grid'],
                                    ['DC-SG', 'DC, SG PPA/DAM/RTM'],
                                    ['Activities', 'Daily activities text'],
                                ].map(([sheet, desc]) => (
                                    <div key={sheet} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: 13 }}>{sheet}</span>
                                            <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>{desc}</span>
                                        </div>
                                        {p?.sheetsFound ? <Tag ok={p.sheetsFound[sheet]} /> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => previewMutation.mutate()}
                                disabled={!file || previewMutation.isPending || saveMutation.isPending}>
                                {previewMutation.isPending ? '⏳ Extracting...' : '👁 Preview Extracted Data'}
                            </button>
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => saveMutation.mutate()}
                                disabled={!file || saveMutation.isPending || previewMutation.isPending}>
                                {saveMutation.isPending ? '⏳ Saving all modules...' : '✅ Import & Save All Modules'}
                            </button>
                        </div>

                        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                            💡 <strong>Import & Save</strong> writes Power, Fuel, Performance, Water, Ash,
                            Availability, Scheduling in one transaction and marks all as <em>submitted</em>.
                            DGR report will be available immediately after.
                        </div>
                    </div>

                    {/* Right — preview */}
                    <div>
                        {p ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                {/* Power */}
                                <div className="card">
                                    <div className="card-hdr"><div className="card-title">⚡ Power</div></div>
                                    <div className="card-body" style={{ padding: '8px 16px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <Row label="Generation" value={fmt(p.powerData?.generation_mu)} unit="MU" />
                                                <Row label="Export (GT)" value={fmt(p.powerData?.export_mu)} unit="MU" />
                                                <Row label="Import (GT)" value={fmt(p.powerData?.import_mu)} unit="MU" />
                                                <Row label="APC" value={fmt(p.powerData?.apc_mu)} unit="MU" />
                                                <Row label="APC %" value={fmt((p.powerData?.apc_pct || 0) * 100, 2)} unit="%" />
                                                <Row label="Hours on Grid" value={fmt(p.availData?.hours_on_grid, 2)} unit="hrs" />
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Fuel */}
                                <div className="card">
                                    <div className="card-hdr"><div className="card-title">🔥 Fuel</div></div>
                                    <div className="card-body" style={{ padding: '8px 16px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <Row label="Coal Cons" value={fmt(p.fuelData?.coal_cons_mt, 2)} unit="MT" />
                                                <Row label="Coal Stock" value={fmt(p.fuelData?.coal_stock_mt, 2)} unit="MT" />
                                                <Row label="GCV (AF)" value={fmt(p.fuelData?.coal_gcv_af, 0)} unit="kcal/kg" />
                                                <Row label="GHR" value={fmt(p.perfData?.ghr_direct, 0)} unit="kcal/kWh" />
                                                <Row label="LDO Cons" value={fmt(p.fuelData?.ldo_cons_kl, 3)} unit="KL" />
                                                <Row label="HFO Cons" value={fmt(p.fuelData?.hfo_cons_kl, 3)} unit="KL" />
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Scheduling */}
                                <div className="card">
                                    <div className="card-hdr"><div className="card-title">📅 Scheduling</div></div>
                                    <div className="card-body" style={{ padding: '8px 16px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <Row label="DC (TNPDCL)" value={fmt(p.schedulingData?.dc_tnpdcl_mu)} unit="MU" />
                                                <Row label="SG PPA" value={fmt(p.schedulingData?.sg_ppa_mu)} unit="MU" />
                                                <Row label="SG RTM" value={fmt(p.schedulingData?.sg_rtm_mu)} unit="MU" />
                                                <Row label="SG DAM" value={fmt(p.schedulingData?.sg_dam_mu)} unit="MU" />
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Water & Availability */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="card">
                                        <div className="card-hdr"><div className="card-title">💧 Water</div></div>
                                        <div className="card-body" style={{ padding: '8px 16px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                    <Row label="DM Gen" value={fmt(p.waterData?.dm_generation_m3, 0)} unit="m³" />
                                                    <Row label="DM Cons" value={fmt(p.waterData?.dm_total_cons_m3, 0)} unit="m³" />
                                                    <Row label="CT Makeup" value={fmt(p.waterData?.idct_makeup_m3, 0)} unit="m³" />
                                                    <Row label="Outfall" value={fmt(p.waterData?.outfall_m3, 0)} unit="m³" />
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="card-hdr"><div className="card-title">🏭 Availability</div></div>
                                        <div className="card-body" style={{ padding: '8px 16px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                    <Row label="PAF %" value={fmt((p.availData?.paf_pct || 0) * 100, 2)} unit="%" />
                                                    <Row label="FA Generated" value={fmt(p.ashData?.fa_generated_mt, 2)} unit="MT" />
                                                    <Row label="FA to User" value={fmt(p.ashData?.fa_to_user_mt, 2)} unit="MT" />
                                                    <Row label="BA Generated" value={fmt(p.ashData?.ba_generated_mt, 2)} unit="MT" />
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="card" style={{ border: '2px dashed var(--border)' }}>
                                <div className="card-body" style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Extracted data preview</div>
                                    <div style={{ fontSize: 12 }}>
                                        Upload a DGR Excel file and click <strong>Preview</strong> to see<br />
                                        extracted values before saving to database.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
