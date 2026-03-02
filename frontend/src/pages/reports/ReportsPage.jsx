// src/pages/reports/ReportsPage.jsx
import { useState } from 'react'
import { usePlant } from '../../context/PlantContext'
import { reports } from '../../api'

const today = new Date().toISOString().split('T')[0]

export default function ReportsPage() {
  const { selectedPlant } = usePlant()
  const plantId = selectedPlant?.id
  const [date, setDate]     = useState(today)
  const [loading, setLoading] = useState({})
  const [msg, setMsg]       = useState(null)

  const download = async (type) => {
    if (!plantId) return setMsg({ type: 'error', text: 'Select a plant first' })
    setLoading(l => ({ ...l, [type]: true }))
    setMsg(null)
    try {
      let res
      if (type === 'excel') res = await reports.downloadExcel(plantId, date)
      if (type === 'sap')   res = await reports.downloadSAP(plantId, date)
      const url  = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href  = url
      link.download = `DGR_${selectedPlant.short_name}_${date}.${type === 'excel' ? 'xlsx' : 'json'}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Download failed — ensure data is approved first' })
    } finally {
      setLoading(l => ({ ...l, [type]: false }))
    }
  }

  const REPORT_TYPES = [
    { id: 'excel',    icon: '📊', title: 'Daily DGR', desc: 'Full Excel DGR report matching original format', color: '#16a34a' },
    { id: 'sap',      icon: '🔷', title: 'SAP Export', desc: 'SAP-compatible generation data in JSON format', color: '#2563eb' },
    { id: 'monthly',  icon: '📅', title: 'Monthly Report', desc: 'Month-to-date consolidated summary', color: '#7c3aed', disabled: true },
    { id: 'ldclrs',   icon: '📋', title: 'LDC LRS Report', desc: 'Load Despatch Centre regulatory submission', color: '#0d9488', disabled: true },
    { id: 'detailed', icon: '🔍', title: 'Detailed Report', desc: 'All parameters with audit trail', color: '#d97706', disabled: true },
    { id: 'inception',icon: '🗃', title: 'Since Inception', desc: 'Historical data from plant start date', color: '#6b7280', disabled: true },
  ]

  return (
    <div>
      <div className="page-title">📄 DGR Reports</div>
      <div className="page-sub">Generate and download reports in various formats</div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Report Date</label>
              <input className="form-input" type="date" value={date} max={today}
                onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Plant: <strong>{selectedPlant?.name || 'None selected'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {REPORT_TYPES.map(r => (
          <div key={r.id} className="card" style={{ opacity: r.disabled ? 0.55 : 1 }}>
            <div className="card-body">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{r.desc}</div>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', borderColor: r.color, color: r.color }}
                onClick={() => !r.disabled && download(r.id)}
                disabled={r.disabled || loading[r.id] || !plantId}
              >
                {loading[r.id] ? '⏳ Generating...' : r.disabled ? '🔒 Coming Soon' : '⬇ Download'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
