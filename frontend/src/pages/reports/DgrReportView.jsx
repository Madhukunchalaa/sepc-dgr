// src/pages/reports/DgrReportView.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dgr } from '../../api'

const today = new Date().toISOString().split('T')[0]

const fmt = (val) => {
    if (val == null || val === '') return '-';
    if (typeof val === 'number') return val.toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    if (typeof val === 'string') {
        const num = Number(val);
        if (!isNaN(num) && val.trim() !== '') return num.toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }
    return String(val);
}

const thStyle = { padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', width: 90, fontSize: 12 }
const tdStyle = { padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }

// Standard table (TAQA / TTPP): daily | mtd | ytd
function StandardTable({ title, rows }) {
    if (!rows?.length) return null;
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc' }}>
                <div className="card-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: '#334155' }}>{title}</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', width: 60 }}>SN</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>Particulars</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>UoM</th>
                            <th style={thStyle}>DAILY</th>
                            <th style={thStyle}>MTD</th>
                            <th style={thStyle}>YTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--muted)' }}>{row.sn}</td>
                                <td style={{ padding: '8px 16px', fontWeight: 500 }}>{row.particulars}</td>
                                <td style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.uom}</td>
                                <td style={tdStyle}>{fmt(row.daily)}</td>
                                <td style={tdStyle}>{fmt(row.mtd)}</td>
                                <td style={tdStyle}>{fmt(row.ytd)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// Multi-unit table (Anpara): Unit#1 | Unit#2 | Station × Daily/MTD/YTD
function MultiUnitTable({ title, rows }) {
    if (!rows?.length) return null;
    const grp = { background: '#e8f0fe', fontWeight: 700, fontSize: 11, color: '#1e40af', textAlign: 'center', padding: '4px 0' }
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc' }}>
                <div className="card-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: '#334155' }}>{title}</div>
            </div>
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: '#e8f0fe' }}>
                            <th rowSpan={2} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', minWidth: 160 }}>Particulars</th>
                            <th rowSpan={2} style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', width: 60 }}>UoM</th>
                            <th colSpan={3} style={grp}>DAILY</th>
                            <th colSpan={3} style={grp}>MTD</th>
                            <th colSpan={3} style={grp}>YTD</th>
                        </tr>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                            {['Unit#1','Unit#2','Station','Unit#1','Unit#2','Station','Unit#1','Unit#2','Station'].map((h, i) => (
                                <th key={i} style={{ ...thStyle, fontSize: 11 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '7px 12px', fontWeight: 500 }}>{row.particulars}</td>
                                <td style={{ padding: '7px 8px', color: 'var(--muted)', fontSize: 11 }}>{row.uom}</td>
                                <td style={tdStyle}>{fmt(row.daily_u1)}</td>
                                <td style={tdStyle}>{fmt(row.daily_u2)}</td>
                                <td style={{ ...tdStyle, borderRight: '2px solid #e2e8f0', fontWeight: 700 }}>{fmt(row.daily_st)}</td>
                                <td style={tdStyle}>{fmt(row.mtd_u1)}</td>
                                <td style={tdStyle}>{fmt(row.mtd_u2)}</td>
                                <td style={{ ...tdStyle, borderRight: '2px solid #e2e8f0', fontWeight: 700 }}>{fmt(row.mtd_st)}</td>
                                <td style={tdStyle}>{fmt(row.ytd_u1)}</td>
                                <td style={tdStyle}>{fmt(row.ytd_u2)}</td>
                                <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(row.ytd_st)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function TableBox({ title, rows, isMultiUnit }) {
    return isMultiUnit
        ? <MultiUnitTable title={title} rows={rows} />
        : <StandardTable title={title} rows={rows} />
}

export default function DgrReportView() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)

    const { data: reportData, isLoading, error } = useQuery({
        queryKey: ['dgr-full', plantId, date],
        queryFn: () => dgr.get(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    const d = reportData?.data?.data

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="page-title">🔍 Comprehensive DGR View</div>
            <div className="page-sub">Read-only final master generation report with combined calculations</div>

            <div className="card" style={{ marginBottom: 24, padding: 16 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Report Date</label>
                        <input className="form-input" type="date" value={date} max={today}
                            onChange={e => setDate(e.target.value)} />
                    </div>
                </div>
            </div>

            {!plantId ? (
                <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
            ) : isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>⏳ Assembling DGR Engine...</div>
            ) : error || !d ? (
                <div className="alert alert-error">❌ No formal DGR report has been generated for this date.</div>
            ) : (
                <div id="dgr-print-area" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000, margin: '0 auto', background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>

                    {/* Report Header exactly like Excel */}
                    <div style={{ textAlign: 'center', borderBottom: '3px solid #000', paddingBottom: 20 }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: 24 }}>{d.header.company}</h2>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 500 }}>{d.header.plantName}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                            <div>Doc No: {d.header.documentNumber}</div>
                            <div style={{ fontSize: 16 }}>{d.header.title}</div>
                            <div>Date: {new Date(d.header.date).toLocaleDateString('en-GB')}</div>
                        </div>
                    </div>

                    {/* Dynamic Sections mapped exactly from the backend Engine Output */}
                    {(() => {
                        const isMultiUnit = Array.isArray(d.header?.units) && d.header.units.length > 1
                        return d.sections?.map((section, idx) => (
                            <TableBox key={idx} title={section.title} rows={section.rows} isMultiUnit={isMultiUnit} />
                        ))
                    })()}

                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 24 }}>
                        Generated natively by DGR Compute Engine at {new Date(d.meta.generatedAt).toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    )
}
