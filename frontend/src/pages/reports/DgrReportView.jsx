// src/pages/reports/DgrReportView.jsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dgr } from '../../api'

const today = new Date().toISOString().split('T')[0]

// Utility to render nicely aligned tables just like Excel
function TableBox({ title, data, columns }) {
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc' }}>
                <div className="card-title" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--primary)' }}>
                    {title}
                </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>Parameter</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>UOM</th>
                            {columns.map(c => (
                                <th key={c} style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--muted)' }}>{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 16px', fontWeight: 500 }}>{row.label}</td>
                                <td style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.uom}</td>
                                {columns.map(c => {
                                    const val = row[c.toLowerCase()];
                                    return (
                                        <td key={c} style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: val != null ? 600 : 400 }}>
                                            {val != null ? Number(val).toLocaleString('en-IN', { minimumFractionDigits: row.dec ?? 2, maximumFractionDigits: row.dec ?? 2 }) : '-'}
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

    // Shape the data rows matching Excel exactly
    const powerRows = useMemo(() => {
        if (!d?.power) return []
        const p = d.power
        return [
            { label: p.generation.label, uom: p.generation.uom, daily: p.generation.daily, mtd: p.generation.mtd, ytd: p.generation.ytd, dec: 2 },
            { label: p.avgLoad.label, uom: p.avgLoad.uom, daily: p.avgLoad.daily, mtd: p.avgLoad.mtd, ytd: p.avgLoad.ytd, dec: 2 },
            { label: p.exportGT.label, uom: p.exportGT.uom, daily: p.exportGT.daily, mtd: p.exportGT.mtd, ytd: p.exportGT.ytd, dec: 3 },
            { label: p.importGT.label, uom: p.importGT.uom, daily: p.importGT.daily, mtd: p.importGT.mtd, ytd: p.importGT.ytd, dec: 3 },
            { label: p.apc.label, uom: p.apc.uom, daily: p.apc.daily, mtd: p.apc.mtd, ytd: p.apc.ytd, dec: 3 },
            { label: 'APC %', uom: '%', daily: p.apc.pct?.daily, mtd: p.apc.pct?.mtd, ytd: p.apc.pct?.ytd, dec: 2 },
        ]
    }, [d])

    const perfRows = useMemo(() => {
        if (!d?.performance) return []
        const p = d.performance

        const rows = []

        // Plant Load Factor (Daily / MTD / YTD)
        rows.push({
            label: p.plf.label,
            uom: p.plf.uom,
            daily: p.plf.daily,
            mtd: p.plf.mtd,
            ytd: p.plf.ytd,
            dec: 2,
        })

        // Partial Loading = 100% - PLF% (matches Excel sheet layout)
        const partial = (val) =>
            val != null ? 100 - Number(val) : null
        rows.push({
            label: 'Partial Loading',
            uom: '%',
            daily: partial(p.plf.daily),
            mtd: partial(p.plf.mtd),
            ytd: partial(p.plf.ytd),
            dec: 2,
        })

        // Plant Availability Factor (SEPC)
        rows.push({
            label: p.paf.label,
            uom: p.paf.uom,
            daily: p.paf.daily,
            mtd: p.paf.mtd,
            ytd: p.paf.ytd,
            dec: 2,
        })

        // Plant Availability Factor (TNPDCL) – same source values, separate row like Excel
        if (p.pafTnpdcl) {
            rows.push({
                label: p.pafTnpdcl.label,
                uom: p.pafTnpdcl.uom,
                daily: p.pafTnpdcl.daily,
                mtd: p.pafTnpdcl.mtd,
                ytd: p.pafTnpdcl.ytd,
                dec: 2,
            })
        }

        // Outage counts (Forced / Planned / RSD) – shown as counts like Excel
        if (p.outages) {
            rows.push(
                {
                    label: 'Plant Outage (Forced)',
                    uom: 'Count',
                    daily: p.outages.forced?.daily,
                    mtd: p.outages.forced?.mtd,
                    ytd: p.outages.forced?.ytd,
                    dec: 0,
                },
                {
                    label: 'Plant Outage (Planned)',
                    uom: 'Count',
                    daily: p.outages.planned?.daily,
                    mtd: p.outages.planned?.mtd,
                    ytd: p.outages.planned?.ytd,
                    dec: 0,
                },
                {
                    label: 'RSD',
                    uom: 'Count',
                    daily: p.outages.rsd?.daily,
                    mtd: p.outages.rsd?.mtd,
                    ytd: p.outages.rsd?.ytd,
                    dec: 0,
                }
            )
        }

        // Specific consumptions and GHR / GCV
        rows.push(
            { label: p.soc.label, uom: p.soc.uom, daily: p.soc.daily, mtd: p.soc.mtd, ytd: p.soc.ytd, dec: 2 },
            { label: p.scc.label, uom: p.scc.uom, daily: p.scc.daily, mtd: p.scc.mtd, ytd: p.scc.ytd, dec: 4 },
            { label: p.ghr.label, uom: p.ghr.uom, daily: p.ghr.daily, mtd: p.ghr.mtd, ytd: p.ghr.ytd, dec: 2 },
            { label: p.gcv.label, uom: p.gcv.uom, daily: p.gcv.daily, mtd: p.gcv.mtd, ytd: p.gcv.ytd, dec: 0 },
        )

        return rows
    }, [d])

    const consRows = useMemo(() => {
        if (!d?.consumptionStock) return []
        const c = d.consumptionStock
        return [
            { label: c.coalConsumption.label, uom: c.coalConsumption.uom, daily: c.coalConsumption.daily, mtd: c.coalConsumption.mtd, ytd: c.coalConsumption.ytd, dec: 2 },
            { label: c.ldoConsumption.label, uom: c.ldoConsumption.uom, daily: c.ldoConsumption.daily, mtd: c.ldoConsumption.mtd, ytd: c.ldoConsumption.ytd, dec: 3 },
            { label: c.hfoConsumption.label, uom: c.hfoConsumption.uom, daily: c.hfoConsumption.daily, mtd: c.hfoConsumption.mtd, ytd: c.hfoConsumption.ytd, dec: 3 },
            { label: c.coalReceipt.label, uom: c.coalReceipt.uom, daily: c.coalReceipt.daily, mtd: c.coalReceipt.mtd, ytd: c.coalReceipt.ytd, dec: 2 },
            { label: c.ldoReceipt.label, uom: c.ldoReceipt.uom, daily: c.ldoReceipt.daily, mtd: c.ldoReceipt.mtd, ytd: c.ldoReceipt.ytd, dec: 3 },
            { label: c.hfoReceipt.label, uom: c.hfoReceipt.uom, daily: c.hfoReceipt.daily, mtd: c.hfoReceipt.mtd, ytd: c.hfoReceipt.ytd, dec: 3 },
            { label: c.dmWater.label, uom: c.dmWater.uom, daily: c.dmWater.daily, mtd: null, ytd: null, dec: 0 },
            { label: 'DM Water Cycle %', uom: '%', daily: c.dmWater.pct, mtd: null, ytd: null, dec: 2 },
        ]
    }, [d])

    const schedRows = useMemo(() => {
        if (!d?.scheduling) return []
        const s = d.scheduling
        return [
            { label: s.dcSEPC.label, uom: s.dcSEPC.uom, daily: s.dcSEPC.daily, mtd: s.dcSEPC.mtd, ytd: s.dcSEPC.ytd, dec: 3 },
            { label: s.dcTNPDCL.label, uom: s.dcTNPDCL.uom, daily: s.dcTNPDCL.daily, mtd: s.dcTNPDCL.mtd, ytd: s.dcTNPDCL.ytd, dec: 3 },
            { label: s.sgPPA.label, uom: s.sgPPA.uom, daily: s.sgPPA.daily, mtd: s.sgPPA.mtd, ytd: s.sgPPA.ytd, dec: 3 },
            { label: s.sgDAM.label, uom: s.sgDAM.uom, daily: s.sgDAM.daily, mtd: s.sgDAM.mtd, ytd: s.sgDAM.ytd, dec: 3 },
            { label: s.sgRTM.label, uom: s.sgRTM.uom, daily: s.sgRTM.daily, mtd: s.sgRTM.mtd, ytd: s.sgRTM.ytd, dec: 3 },
        ]
    }, [d])

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
            ) : error ? (
                <div className="alert alert-error">❌ Found no data submitted for this date.</div>
            ) : !d ? (
                <div className="alert alert-info">No report available for this date.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000, margin: '0 auto', background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>

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

                    {/* Metrics Tables */}
                    <TableBox title="Power Generation & Export" data={powerRows} columns={['Daily', 'MTD', 'YTD']} />
                    <TableBox title="Plant Performance" data={perfRows} columns={['Daily', 'MTD', 'YTD']} />
                    <TableBox title="Consumption & Receipts" data={consRows} columns={['Daily', 'MTD', 'YTD']} />
                    <TableBox title="Scheduling (TNPDCL)" data={schedRows} columns={['Daily', 'MTD', 'YTD']} />

                    {/* Observations */}
                    <div className="card" style={{ border: '1px dashed #cbd5e1' }}>
                        <div className="card-hdr" style={{ background: '#f8fafc' }}>
                            <div className="card-title" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Daily Operations & Remarks</div>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>BOILER</div>
                                    <div style={{ fontSize: 13, background: '#f1f5f9', padding: 8, borderRadius: 4, minHeight: 40 }}>{d.operations?.boiler_activity || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>TURBINE</div>
                                    <div style={{ fontSize: 13, background: '#f1f5f9', padding: 8, borderRadius: 4, minHeight: 40 }}>{d.operations?.turbine_activity || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>ELECTRICAL</div>
                                    <div style={{ fontSize: 13, background: '#f1f5f9', padding: 8, borderRadius: 4, minHeight: 40 }}>{d.operations?.electrical_activity || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>BOP</div>
                                    <div style={{ fontSize: 13, background: '#f1f5f9', padding: 8, borderRadius: 4, minHeight: 40 }}>{d.operations?.bop_activity || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 24 }}>
                        Generated natively by DGR Compute Engine at {new Date(d.meta.generatedAt).toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    )
}
