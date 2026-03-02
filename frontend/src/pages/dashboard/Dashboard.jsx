// src/pages/dashboard/Dashboard.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePlant } from '../../context/PlantContext'
import { useAuth } from '../../context/AuthContext'
import { plants, dgr } from '../../api'

function fmt(val, dec = 3) {
  if (val == null || isNaN(val)) return '—'
  return parseFloat(val).toFixed(dec)
}

const MODULE_LABELS = {
  power: 'Power Generation', fuel: 'Fuel & Performance',
  performance: 'Performance', water: 'Water Management',
  availability: 'Availability', scheduling: 'Energy Scheduling',
  operations: 'Operations Log',
}

export default function Dashboard() {
  const { selectedPlant } = usePlant()
  const { user } = useAuth()
  const navigate = useNavigate()
  const plantId  = selectedPlant?.id

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['submission-status', plantId, date],
    queryFn:  () => plants.submissionStatus(plantId, date),
    enabled:  !!plantId,
  })

  const { data: dgrData } = useQuery({
    queryKey: ['dgr', plantId, date],
    queryFn:  () => dgr.get(plantId, date),
    enabled:  !!plantId,
  })

  const modules  = statusData?.data?.data?.modules || []
  const dgrInfo  = dgrData?.data?.data
  const power    = dgrInfo?.power
  const perf     = dgrInfo?.performance

  const submitted = modules.filter(m => ['submitted','approved'].includes(m.status)).length
  const total     = modules.length

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div>
      <div className="page-title">{greeting()}, {user?.full_name?.split(' ')[0]} 👋</div>
      <div className="page-sub">
        {new Date(date).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
        {selectedPlant && ` · ${selectedPlant.name}`}
      </div>

      {!plantId ? (
        <div className="alert alert-info">ℹ No plant selected. Please select a plant from the sidebar.</div>
      ) : (
        <>
          {/* Date selector for dashboard context */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Dashboard Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-label">Generation Today</div>
                <div className="kpi-icon ic-blue">⚡</div>
              </div>
              <div className="kpi-val">{fmt(power?.generation?.daily)} <span>MU</span></div>
              <div className="kpi-trend trend-flat mono" style={{fontSize:11}}>
                MTD: {fmt(power?.generation?.mtd)} MU
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-label">Plant Load Factor</div>
                <div className="kpi-icon ic-green">📈</div>
              </div>
              <div className="kpi-val">{fmt(perf?.plf?.daily ? perf.plf.daily * 100 : null, 2)} <span>%</span></div>
              <div className="kpi-trend trend-flat mono" style={{fontSize:11}}>
                MTD: {fmt(perf?.plf?.mtd ? perf.plf.mtd * 100 : null, 2)}%
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-label">Gross Heat Rate</div>
                <div className="kpi-icon ic-yellow">🔥</div>
              </div>
              <div className="kpi-val">{fmt(perf?.ghr?.daily, 0)} <span>kCal/kWh</span></div>
              <div className="kpi-trend trend-flat mono" style={{fontSize:11}}>
                MTD: {fmt(perf?.ghr?.mtd, 0)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-label">Submission Progress</div>
                <div className="kpi-icon ic-teal">✅</div>
              </div>
              <div className="kpi-val">{submitted} <span>/ {total}</span></div>
              <div className="pct-bar" style={{marginTop:8}}>
                <div className="pct-track" style={{flex:1}}>
                  <div className="pct-fill green" style={{width:`${total ? (submitted/total)*100 : 0}%`}}/>
                </div>
                <div className="pct-num">{total ? Math.round((submitted/total)*100) : 0}%</div>
              </div>
            </div>
          </div>

          {/* Submission status + quick actions */}
          <div className="section-row">
            <div className="card">
              <div className="card-hdr">
                <div className="card-title">Submission Status — {date}</div>
                <div className="card-action" onClick={() => navigate('/data-entry/power')}>Enter Data →</div>
              </div>
              <div className="card-body" style={{padding:0}}>
                {statusLoading ? (
                  <div style={{padding:24, textAlign:'center', color:'var(--muted)'}}>Loading...</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Module</th><th>Status</th><th>Submitted By</th><th>Time</th><th></th></tr>
                    </thead>
                    <tbody>
                      {modules.map(m => (
                        <tr key={m.module}>
                          <td style={{fontWeight:500}}>{MODULE_LABELS[m.module] || m.module}</td>
                          <td>
                            <span className={`tag ${
                              m.status === 'approved'  ? 'tag-done' :
                              m.status === 'submitted' ? 'tag-pend' :
                              m.status === 'draft'     ? 'tag-draft':
                              'tag-miss'
                            }`}>
                              {m.status === 'not_started' ? '✗ Not Started' :
                               m.status === 'draft'       ? '✎ Draft' :
                               m.status === 'submitted'   ? '⏳ Pending Approval' :
                               '✓ Approved'}
                            </span>
                          </td>
                          <td style={{color:'var(--muted)', fontSize:12}}>{m.submitted_by_name || '—'}</td>
                          <td className="mono" style={{fontSize:11, color:'var(--muted)'}}>
                            {m.submitted_at ? new Date(m.submitted_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : '—'}
                          </td>
                          <td>
                            {m.status === 'not_started' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate(`/data-entry/${m.module === 'fuel' ? 'fuel' : 'power'}`)}
                              >
                                Enter
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              <div className="card">
                <div className="card-body">
                  <div style={{fontSize:13, fontWeight:700, marginBottom:14, color:'var(--text)'}}>Quick Actions</div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    <button className="btn btn-primary" style={{justifyContent:'center'}} onClick={() => navigate('/data-entry/power')}>
                      ⚡ Enter Power Data
                    </button>
                    <button className="btn btn-ghost" style={{justifyContent:'center'}} onClick={() => navigate('/data-entry/fuel')}>
                      🔥 Enter Fuel Data
                    </button>
                    <button className="btn btn-ghost" style={{justifyContent:'center'}} onClick={() => navigate('/data-entry/scada')}>
                      📤 Upload SCADA File
                    </button>
                    <button className="btn btn-ghost" style={{justifyContent:'center'}} onClick={() => navigate('/reports')}>
                      📄 Generate DGR Report
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div style={{fontSize:13, fontWeight:700, marginBottom:12, color:'var(--text)'}}>Plant Info</div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {[
                      ['Capacity', `${selectedPlant?.capacity_mw} MW`],
                      ['PLF Base', `${selectedPlant?.plf_base_mw} MW`],
                      ['Location', selectedPlant?.location],
                    ].map(([k, v]) => (
                      <div key={k} style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
                        <span style={{color:'var(--muted)'}}>{k}</span>
                        <span style={{fontWeight:600}} className="mono">{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
