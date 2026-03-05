// src/pages/reports/DgrReportView.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dgr } from '../../api'

const today = new Date().toISOString().split('T')[0]

// Utility to render nicely aligned tables just like Excel
function TableBox({ title, rows }) {
    if (!rows || rows.length === 0) return null;
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc' }}>
                <div className="card-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: '#334155' }}>
                    {title}
                </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', width: 60 }}>SN</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>Particulars</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>UoM</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', width: 100 }}>DAILY</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', width: 100 }}>MTD</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--muted)', width: 100 }}>YTD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--muted)' }}>{row.sn}</td>
                                <td style={{ padding: '8px 16px', fontWeight: 500 }}>{row.particulars}</td>
                                <td style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.uom}</td>
                                {['daily', 'mtd', 'ytd'].map(c => {
                                    const val = row[c];
                                    return (
                                        <td key={c} style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: val != null && val !== '' ? 600 : 400 }}>
                                            {
                                                (() => {
                                                    if (val == null || val === '') return '-';
                                                    if (typeof val === 'number') return Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
                                                    if (typeof val === 'string') {
                                                        const num = Number(val);
                                                        if (!isNaN(num) && val.trim() !== '') {
                                                            return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
                                                        }
                                                    }
                                                    return String(val);
                                                })()
                                            }
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
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
                    {d.sections?.map((section, idx) => (
                        <TableBox key={idx} title={section.title} rows={section.rows} />
                    ))}

                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 24 }}>
                        Generated natively by DGR Compute Engine at {new Date(d.meta.generatedAt).toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    )
}
