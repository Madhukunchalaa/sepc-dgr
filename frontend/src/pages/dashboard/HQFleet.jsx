// src/pages/dashboard/HQFleet.jsx
import { useQuery } from '@tanstack/react-query'
import { dgr } from '../../api'

const today = new Date().toISOString().split('T')[0]

export default function HQFleet() {
  const { data, isLoading } = useQuery({
    queryKey: ['fleet', today],
    queryFn:  () => dgr.fleet(today),
  })

  const fleet   = data?.data?.data?.fleet || []
  const summary = data?.data?.data

  const fmt = (v, d = 3) => v == null ? '—' : parseFloat(v).toFixed(d)

  return (
    <div>
      <div className="page-title">🌐 HQ Fleet View</div>
      <div className="page-sub">Cross-plant performance summary for {today}</div>

      {isLoading ? (
        <div className="alert alert-info">Loading fleet data...</div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Plants', val: summary?.totalPlants, unit: '', icon: '🏭', cls: 'ic-blue' },
              { label: 'Fully Submitted', val: summary?.fullySubmitted, unit: '', icon: '✅', cls: 'ic-green' },
              { label: 'Fleet Generation', val: fmt(summary?.fleetGenerationMU), unit: 'MU', icon: '⚡', cls: 'ic-yellow' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-label">{k.label}</div>
                  <div className={`kpi-icon ${k.cls}`}>{k.icon}</div>
                </div>
                <div className="kpi-val">{k.val} <span>{k.unit}</span></div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-hdr"><div className="card-title">Plant-wise Performance</div></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plant</th><th>Location</th><th>Capacity</th>
                    <th>Generation (MU)</th><th>PLF %</th><th>APC %</th>
                    <th>Coal Stock (MT)</th><th>Modules</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No data available</td></tr>
                  ) : fleet.map(p => (
                    <tr key={p.plantId}>
                      <td style={{ fontWeight: 700 }}>{p.shortName}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.location}</td>
                      <td className="mono">{p.capacityMW} MW</td>
                      <td className="mono" style={{ color: 'var(--blue)', fontWeight: 600 }}>{fmt(p.generationMU)}</td>
                      <td className="mono">{fmt(p.plfPct * 100, 2)}%</td>
                      <td className="mono">{fmt(p.apcPct * 100, 2)}%</td>
                      <td className="mono">{fmt(p.coalStockMT, 0)}</td>
                      <td>
                        <div className="pct-bar">
                          <div className="pct-track">
                            <div className="pct-fill green" style={{ width: `${(p.submittedModules / p.totalModules) * 100}%` }} />
                          </div>
                          <div className="pct-num">{p.submittedModules}/{p.totalModules}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
