// src/pages/dashboard/ApprovalsPage.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataEntry } from '../../api'

export default function ApprovalsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn:  () => dataEntry.pendingApprovals(),
    refetchInterval: 30000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ plantId, entryDate, module }) => {
      if (module === 'fuel') return dataEntry.approveFuel({ plantId, entryDate })
      return dataEntry.approvePower({ plantId, entryDate })
    },
    onSuccess: () => qc.invalidateQueries(['pending-approvals']),
  })

  const pending = data?.data?.data?.pending || []

  return (
    <div>
      <div className="page-title">✅ Approvals</div>
      <div className="page-sub">Review and approve submitted data entries</div>

      {isLoading ? (
        <div className="alert alert-info">Loading pending approvals...</div>
      ) : pending.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>All caught up!</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>No pending approvals</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Pending Approvals</div>
            <span className="tag tag-pend">{pending.length} Waiting</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plant</th><th>Date</th><th>Module</th>
                  <th>Submitted By</th><th>Time</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.short_name || p.plant_name}</td>
                    <td className="mono">{p.entry_date}</td>
                    <td><span className="tag tag-pend">{p.module}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{p.submitted_by_name || '—'}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {p.submitted_at ? new Date(p.submitted_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => approveMutation.mutate({ plantId: p.plant_id, entryDate: p.entry_date, module: p.module })}
                        disabled={approveMutation.isPending}
                      >
                        ✓ Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
