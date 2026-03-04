// src/pages/data-entry/SchedulingEntry.jsx
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

export default function SchedulingEntry() {
    const { selectedPlant } = usePlant()
    const plantId = selectedPlant?.id
    const [date, setDate] = useState(today)

    // Scheduling Form
    const [schedForm, setSchedForm] = useState({})

    // Availability Form
    const [availForm, setAvailForm] = useState({})

    const [msg, setMsg] = useState(null)
    const qc = useQueryClient()

    // Fetch Scheduling Data
    const { data: schedData, isFetching: isFetchingSched } = useQuery({
        queryKey: ['scheduling-entry', plantId, date],
        queryFn: () => dataEntry.getScheduling(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    // Fetch Availability Data
    const { data: availData, isFetching: isFetchingAvail } = useQuery({
        queryKey: ['availability-entry', plantId, date],
        queryFn: () => dataEntry.getAvailability(plantId, date),
        enabled: !!plantId && !!date,
        retry: false,
    })

    // Sync state
    useEffect(() => {
        const s = schedData?.data?.data
        if (s) {
            setSchedForm({
                dcSepcMu: s.dc_sepc_mu, dcTnpdclMu: s.dc_tnpdcl_mu,
                sgPpaMu: s.sg_ppa_mu, sgDamMu: s.sg_dam_mu, sgRtmMu: s.sg_rtm_mu,
                ursDamMwh: s.urs_dam_mwh, ursRtmMwh: s.urs_rtm_mwh,
                ursRevenue: s.urs_revenue, ursNetProfitLacs: s.urs_net_profit_lacs, remarks: s.remarks, status: s.status,
                askingRateMw: s.asking_rate_mw, deemedGenMu: s.deemed_gen_mu,
                lossCoalMu: s.loss_coal_mu, lossCoalPct: s.loss_coal_pct,
                lossCreSmpsMu: s.loss_cre_smps_mu, lossCreSmpsPct: s.loss_cre_smps_pct,
                lossBunkerMu: s.loss_bunker_mu, lossBunkerPct: s.loss_bunker_pct,
                lossAohMu: s.loss_aoh_mu, lossAohPct: s.loss_aoh_pct,
                lossVacuumMu: s.loss_vacuum_mu, lossVacuumPct: s.loss_vacuum_pct
            })
        } else if (!isFetchingSched) {
            setSchedForm({})
        }
    }, [schedData, isFetchingSched])

    useEffect(() => {
        const a = availData?.data?.data
        if (a) {
            setAvailForm({
                onBarHours: a.on_bar_hours, rsdHours: a.rsd_hours,
                forcedOutageHrs: a.forced_outage_hrs, plannedOutageHrs: a.planned_outage_hrs,
                pafPct: a.paf_pct, pafTnpdclPct: a.paf_tnpdcl, status: a.status
            })
        } else if (!isFetchingAvail) {
            setAvailForm({})
        }
    }, [availData, isFetchingAvail])

    const saveSchedMutation = useMutation({ mutationFn: dataEntry.saveScheduling })
    const saveAvailMutation = useMutation({ mutationFn: dataEntry.saveAvailability })

    const submitSchedMutation = useMutation({ mutationFn: () => dataEntry.submitScheduling({ plantId, entryDate: date }) })
    const submitAvailMutation = useMutation({ mutationFn: () => dataEntry.submitAvailability({ plantId, entryDate: date }) })

    const handleSubmit = async () => {
        try {
            await Promise.all([
                submitSchedMutation.mutateAsync(),
                submitAvailMutation.mutateAsync()
            ])
            setMsg({ type: 'success', text: '✓ Submitted for approval' })
            qc.invalidateQueries(['scheduling-entry', plantId, date])
            qc.invalidateQueries(['availability-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
        } catch (err) {
            setMsg({ type: 'error', text: 'Submit failed' })
        }
    }

    const handleSave = async () => {
        try {
            await Promise.all([
                saveSchedMutation.mutateAsync({ plantId, date, data: schedForm }),
                saveAvailMutation.mutateAsync({ plantId, date, data: availForm })
            ])
            setMsg({ type: 'success', text: '✓ Scheduling and Availability saved' })
            qc.invalidateQueries(['scheduling-entry', plantId, date])
            qc.invalidateQueries(['availability-entry', plantId, date])
            qc.invalidateQueries(['submission-status', plantId])
            setTimeout(() => setMsg(null), 3000)
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save entries' })
        }
    }

    const schedStatus = schedForm.status || 'unsubmitted'
    const availStatus = availForm.status || 'unsubmitted'

    // Both need to be mutable unless both are submitted?
    // We'll treat readOnly if EITHER are submitted 
    const readOnly = schedStatus === 'submitted' || schedStatus === 'approved' ||
        availStatus === 'submitted' || availStatus === 'approved'

    const updateSched = (k, v) => setSchedForm(p => ({ ...p, [k]: v }))
    const updateAvail = (k, v) => setAvailForm(p => ({ ...p, [k]: v }))

    return (
        <div>
            <div className="page-title">⏱ Scheduling & Availability Entry</div>
            <div className="page-sub">Daily DC, SG, URS, and availability/outage tracking</div>

            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Entry Date</label>
                            <input
                                className="form-input" type="date" value={date} max={today}
                                onChange={e => {
                                    setDate(e.target.value);
                                    // Let the isFetching effect handle the clearing instead of aggressive nuking
                                }}
                            />
                        </div>
                        {(schedStatus !== 'unsubmitted' || availStatus !== 'unsubmitted') && (
                            <div style={{ paddingBottom: 6 }}>
                                <span className={`tag ${schedStatus === 'approved' ? 'tag-done' : schedStatus === 'submitted' ? 'tag-pend' : 'tag-draft'}`}>
                                    {schedStatus === availStatus ? schedStatus.toUpperCase() : "MIXED"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!plantId ? (
                <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
            ) : (
                <>
                    <div className="form-grid-2">

                        <div className="card">
                            <div className="card-hdr"><div className="card-title">📅 Power Scheduling</div></div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div className="form-grid-2">
                                        {[
                                            ['DC (SEPC)', 'dcSepcMu', 'MU'],
                                            ['DC (TNPDCL)', 'dcTnpdclMu', 'MU'],
                                            ['SG (PPA)', 'sgPpaMu', 'MU'],
                                            ['SG (DAM)', 'sgDamMu', 'MU'],
                                            ['SG (RTM)', 'sgRtmMu', 'MU'],
                                        ].map(([label, key, unit]) => (
                                            <div key={key} className="form-group">
                                                <label>{label}</label>
                                                <div className="input-with-unit">
                                                    <input
                                                        type="number" className="form-input mono"
                                                        value={schedForm[key] ?? ''}
                                                        onChange={e => updateSched(key, e.target.value)}
                                                        readOnly={readOnly} placeholder="0.00"
                                                    />
                                                    <span className="unit">{unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

                                    <div className="form-grid-2">
                                        {[
                                            ['URS (DAM)', 'ursDamMwh', 'MWh'],
                                            ['URS (RTM)', 'ursRtmMwh', 'MWh'],
                                            ['URS Revenue', 'ursRevenue', '₹'],
                                            ['URS Net Profit', 'ursNetProfitLacs', 'Lacs']
                                        ].map(([label, key, unit]) => (
                                            <div key={key} className="form-group">
                                                <label>{label}</label>
                                                <div className="input-with-unit">
                                                    <input
                                                        type="number" className="form-input mono"
                                                        value={schedForm[key] ?? ''}
                                                        onChange={e => updateSched(key, e.target.value)}
                                                        readOnly={readOnly} placeholder="0.00"
                                                    />
                                                    <span className="unit">{unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-hdr"><div className="card-title">⏳ Equipment Availability</div></div>
                            <div className="card-body">
                                <div className="form-grid-2">
                                    {[
                                        ['On Bar Hours', 'onBarHours', 'Hrs'],
                                        ['RSD Hours', 'rsdHours', 'Hrs'],
                                        ['Forced Outage Hours', 'forcedOutageHrs', 'Hrs'],
                                        ['Planned Outage Hours', 'plannedOutageHrs', 'Hrs'],
                                        ['PAF (SEPC)', 'pafPct', '%'],
                                        ['PAF (TNPDCL)', 'pafTnpdclPct', '%'],
                                    ].map(([label, key, unit]) => (
                                        <div key={key} className="form-group">
                                            <label>{label}</label>
                                            <div className="input-with-unit">
                                                <input
                                                    type="number" className="form-input mono"
                                                    value={availForm[key] ?? ''}
                                                    onChange={e => updateAvail(key, e.target.value)}
                                                    readOnly={readOnly} placeholder="0.00"
                                                />
                                                <span className="unit">{unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label>Scheduling Remarks</label>
                                    <textarea
                                        className="form-input"
                                        rows={4}
                                        value={schedForm.remarks || ''}
                                        onChange={e => updateSched('remarks', e.target.value)}
                                        readOnly={readOnly}
                                        placeholder="Enter any qualitative comments for the URS or scheduling metrics..."
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-hdr"><div className="card-title">📉 DC Loss B/U (Capacity – DC TNPDCL)</div></div>
                            <div className="card-body">
                                <div className="form-grid-2">
                                    {[
                                        ['Asking Rate to Achieve 80% DC', 'askingRateMw', 'MW'],
                                        ['Deemed Gen – DG (TB + RSD)', 'deemedGenMu', 'MU'],
                                    ].map(([label, key, unit]) => (
                                        <div key={key} className="form-group">
                                            <label>{label}</label>
                                            <div className="input-with-unit">
                                                <input
                                                    type="number" className="form-input mono"
                                                    value={schedForm[key] ?? ''}
                                                    onChange={e => updateSched(key, e.target.value)}
                                                    readOnly={readOnly} placeholder="0.00"
                                                />
                                                <span className="unit">{unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
                                <div className="form-grid-2">
                                    {['Coal', 'CreSmps', 'Bunker', 'Aoh', 'Vacuum'].map(type => {
                                        const label = type === 'Coal' ? 'Coal Shortage' : type === 'CreSmps' ? 'CRE to SMPS Trip' : type === 'Bunker' ? 'Bunker Choke' : type === 'Aoh' ? 'AOH' : 'Low Vacuum Trip'
                                        const muKey = `loss${type}Mu`
                                        const pctKey = `loss${type}Pct`
                                        return (
                                            <div key={type} className="form-group" style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                                                <label style={{ fontWeight: 600, color: '#334155' }}>{label}</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                                                    <div className="input-with-unit">
                                                        <input type="number" className="form-input mono" value={schedForm[muKey] ?? ''} onChange={e => updateSched(muKey, e.target.value)} readOnly={readOnly} placeholder="MU" />
                                                        <span className="unit">MU</span>
                                                    </div>
                                                    <div className="input-with-unit">
                                                        <input type="number" className="form-input mono" value={schedForm[pctKey] ?? ''} onChange={e => updateSched(pctKey, e.target.value)} readOnly={readOnly} placeholder="%" />
                                                        <span className="unit">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Actions */}
                    {readOnly ? (
                        <div className="alert alert-info" style={{ marginBottom: 40 }}>
                            🔒 This entry is {schedStatus} and cannot be edited.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
                            <button className="btn btn-ghost" onClick={() => { setSchedForm({}); setAvailForm({}); }}>
                                Clear
                            </button>
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-primary" onClick={handleSave} disabled={saveSchedMutation.isPending || saveAvailMutation.isPending} style={{ minWidth: 150 }}>
                                {(saveSchedMutation.isPending || saveAvailMutation.isPending) ? '⏳ Saving...' : '💾 Save Draft'}
                            </button>
                            <button className="btn btn-success"
                                onClick={handleSubmit}
                                disabled={submitSchedMutation.isPending || submitAvailMutation.isPending || (!schedData?.data?.data && !availData?.data?.data)}
                                title={(!schedData?.data?.data && !availData?.data?.data) ? 'Save draft first' : ''}>
                                {(submitSchedMutation.isPending || submitAvailMutation.isPending) ? 'Submitting...' : '✓ Submit for Approval'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
