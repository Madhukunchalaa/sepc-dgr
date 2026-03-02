// src/pages/admin/PlantConfig.jsx
import { useQuery } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { plants } from '../../api'

export default function PlantConfig() {
  const { selectedPlant } = usePlant()
  const plantId = selectedPlant?.id

  const { data, isLoading } = useQuery({
    queryKey: ['plant-detail', plantId],
    queryFn:  () => plants.get(plantId),
    enabled:  !!plantId,
  })

  const detail  = data?.data?.data
  const meters  = detail?.meters  || []
  const fuels   = detail?.fuels   || []
  const plant   = detail?.plant

  return (
    <div>
      <div className="page-title">⚙️ Plant Configuration</div>
      <div className="page-sub">{selectedPlant?.name || 'Select a plant'}</div>

      {!plantId ? (
        <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
      ) : isLoading ? (
        <div className="alert alert-info">Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Plant Info */}
          <div className="card">
            <div className="card-hdr"><div className="card-title">🏭 Plant Details</div></div>
            <div className="card-body">
              {[
                ['Plant Name',     plant?.name],
                ['Short Name',     plant?.short_name],
                ['Location',       plant?.location],
                ['Company',        plant?.company_name],
                ['Document No.',   plant?.document_number],
                ['Capacity (MW)',  plant?.capacity_mw],
                ['PLF Base (MW)',  plant?.plf_base_mw],
                ['FY Start Month', plant?.fy_start_month === 4 ? 'April' : `Month ${plant?.fy_start_month}`],
                ['Status',         plant?.status],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="mono">{v ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fuels */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-hdr"><div className="card-title">🔥 Active Fuel Types</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {fuels.map(f => (
                    <span key={f.fuel_type} className={`tag ${f.is_active ? 'tag-done' : 'tag-na'}`}>
                      {f.fuel_type.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><div className="card-title">📟 Meter Points ({meters.length})</div></div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Name</th><th>MF</th><th>Type</th></tr></thead>
                  <tbody>
                    {meters.map(m => (
                      <tr key={m.meter_code}>
                        <td className="mono" style={{ fontSize: 11 }}>{m.meter_code}</td>
                        <td style={{ fontSize: 12 }}>{m.meter_name}</td>
                        <td className="mono" style={{ color: 'var(--blue)', fontWeight: 600 }}>{m.multiplier}</td>
                        <td><span className={`tag ${m.meter_type === 'generation' ? 'tag-done' : m.meter_type === 'export' ? 'tag-pend' : 'tag-draft'}`}>{m.meter_type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
