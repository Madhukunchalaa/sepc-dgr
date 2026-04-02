import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { useAuth } from '../../context/AuthContext'
import { dataEntry } from '../../api'
import ExcelUploadBtn from '../../components/ExcelUploadBtn'
import { PERFORMANCE_FIELDS } from '../../utils/moduleExcel'

const today = new Date().toISOString().split('T')[0]

function fmt(val, dec = 2) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return parseFloat(val).toFixed(dec)
}

export default function PerformanceEntry() {
  const { selectedPlant } = usePlant()
  const { isRole } = useAuth()
  const plantId = selectedPlant?.id
  const qc = useQueryClient()

  const [date, setDate] = useState(today)
  const [form, setForm] = useState({})
  const [msg, setMsg] = useState(null)

  const { data: existing } = useQuery({
    queryKey: ['performance-entry', plantId, date],
    queryFn: () => dataEntry.getPerformance(plantId, date),
    enabled: !!plantId && !!date,
    retry: false,
  })

  // Clear form immediately when date or plant changes
  useEffect(() => {
    setForm({})
    setMsg(null)
  }, [date, plantId])

  useEffect(() => {
    const e = existing?.data?.data
    if (e) {
      setForm({
        ghrDirect: e.ghr_direct,
        ghrMtd: e.ghr_mtd,
        ghrYtd: e.ghr_ytd,
        gcvAr: e.gcv_ar,
        gcvAf: e.gcv_af,
        loiBa: e.loi_ba,
        loiFa: e.loi_fa,
        fcPct: e.fc_pct,
        vmPct: e.vm_pct,
        fcVmRatio: e.fc_vm_ratio,
        millSieveA: e.mill_sieve_a,
        millSieveB: e.mill_sieve_b,
        millSieveC: e.mill_sieve_c,
        ghrRemarks: e.ghr_remarks,
        status: e.status,
      })
    } else {
      setForm({})
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: (payload) => dataEntry.savePerformance(payload),
    onSuccess: () => {
      setMsg({ type: 'success', text: '✓ Performance entry saved' })
      qc.invalidateQueries(['performance-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId, date])
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (err) => {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Save failed' })
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => dataEntry.submitPerformance({ plantId, entryDate: date }),
    onSuccess: () => {
      setMsg({ type: 'success', text: '✓ Submitted for approval' })
      qc.invalidateQueries(['performance-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId, date])
    },
    onError: (err) => {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Submit failed' })
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => dataEntry.unlockPerformance({ plantId, entryDate: date }),
    onSuccess: () => {
      setMsg({ type: 'success', text: '🔓 Entry unlocked — you can now edit' })
      qc.invalidateQueries(['performance-entry', plantId, date])
      qc.invalidateQueries(['submission-status', plantId, date])
    },
    onError: (err) => {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Unlock failed' })
    },
  })

  const status = form.status || 'unsubmitted'
  const readOnly = status === 'submitted' || status === 'approved'

  const update = (key, val) => {
    if (readOnly) return
    setForm((f) => ({ ...f, [key]: val }))
  }

  const handleSave = () => {
    if (!plantId) return
    const payload = {
      plantId,
      date,
      data: {
        ghrDirect: form.ghrDirect,
        ghrMtd: form.ghrMtd,
        ghrYtd: form.ghrYtd,
        gcvAr: form.gcvAr,
        gcvAf: form.gcvAf,
        loiBa: form.loiBa,
        loiFa: form.loiFa,
        fcPct: form.fcPct,
        vmPct: form.vmPct,
        millSieveA: form.millSieveA,
        millSieveB: form.millSieveB,
        millSieveC: form.millSieveC,
        ghrRemarks: form.ghrRemarks,
      },
    }
    saveMutation.mutate(payload)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <div>
          <div className="page-title">🎯 Performance Entry</div>
          <div className="page-sub">Daily performance lab parameters feeding the DGR Performance sheet</div>
        </div>
        <ExcelUploadBtn
          fields={PERFORMANCE_FIELDS}
          currentData={form}
          entryDate={date}
          filename={`performance_${date}.xlsx`}
          onImport={(data) => setForm(f => ({ ...f, ...data }))}
        />
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Entry Date</label>
              <input
                className="form-input"
                type="date"
                value={date}
                max={today}
                onChange={(e) => {
                  setDate(e.target.value)
                  setForm({})
                }}
              />
            </div>
            {status !== 'unsubmitted' && (
              <span
                className={`tag ${status === 'approved' ? 'tag-done' : status === 'submitted' ? 'tag-pend' : 'tag-draft'
                  }`}
              >
                {status.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {!plantId ? (
        <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
      ) : (
        <>
          <div className="form-grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-hdr">
                <div className="card-title">🔥 Heat Rate & GCV</div>
              </div>
              <div className="card-body">
                <div className="form-grid-2">
                  {[
                    ['Daily GHR (Direct)', 'ghrDirect', 'kCal/kWh', 2],
                    ['GHR MTD', 'ghrMtd', 'kCal/kWh', 2],
                    ['GHR YTD', 'ghrYtd', 'kCal/kWh', 2],
                    ['GCV (As Received)', 'gcvAr', 'kCal/kg', 0],
                    ['GCV (As Fired)', 'gcvAf', 'kCal/kg', 0],
                  ].map(([label, key, unit, dec]) => (
                    <div key={key} className="form-group">
                      <label className="form-label">
                        {label} <span className="unit">{unit}</span>
                      </label>
                      <input
                        className="form-input mono"
                        type="number"
                        step={dec === 0 ? 1 : dec === 2 ? 0.01 : 0.001}
                        value={form[key] ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => update(key, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">
                      GHR Remarks <span className="unit">Text</span>
                    </label>
                    <input
                      className="form-input"
                      type="text"
                      value={form.ghrRemarks ?? ''}
                      readOnly={readOnly}
                      onChange={(e) => update('ghrRemarks', e.target.value)}
                      placeholder="e.g. Boiler efficiency dip, Load fluctuation"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr">
                <div className="card-title">🧪 Coal Quality & LOI</div>
              </div>
              <div className="card-body">
                <div className="form-grid-2">
                  {[
                    ['LOI — Bottom Ash', 'loiBa', '%', 3],
                    ['LOI — Fly Ash', 'loiFa', '%', 3],
                    ['Fixed Carbon (FC)', 'fcPct', '%', 3],
                    ['Volatile Matter (VM)', 'vmPct', '%', 3],
                  ].map(([label, key, unit, dec]) => (
                    <div key={key} className="form-group">
                      <label className="form-label">
                        {label} <span className="unit">{unit}</span>
                      </label>
                      <input
                        className="form-input mono"
                        type="number"
                        step={dec === 3 ? 0.001 : 0.01}
                        value={form[key] ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => update(key, e.target.value)}
                        placeholder="0.000"
                      />
                    </div>
                  ))}

                  <div className="form-group">
                    <label className="form-label">
                      FC / VM Ratio <span className="unit">ratio</span>
                    </label>
                    <input
                      className="form-input mono"
                      type="text"
                      value={
                        form.fcPct != null && form.vmPct
                          ? fmt(Number(form.fcPct) / Number(form.vmPct), 4)
                          : form.fcVmRatio != null
                            ? fmt(form.fcVmRatio, 4)
                            : ''
                      }
                      readOnly
                      placeholder="auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr">
              <div className="card-title">🧱 Mill Sieve Analysis (200 mesh)</div>
            </div>
            <div className="card-body">
              <div className="form-grid-3">
                {[
                  ['Mill A Passing', 'millSieveA'],
                  ['Mill B Passing', 'millSieveB'],
                  ['Mill C Passing', 'millSieveC'],
                ].map(([label, key]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">
                      {label} <span className="unit">% &lt; 200 mesh</span>
                    </label>
                    <input
                      className="form-input mono"
                      type="number"
                      step="0.1"
                      value={form[key] ?? ''}
                      readOnly={readOnly}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {readOnly ? (
            <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
              <div className="alert alert-info" style={{ flex: 1, marginBottom: 0 }}>
                🔒 This entry is {status} and cannot be edited.
              </div>
              {isRole('it_admin', 'plant_admin') && (
                <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap', borderColor: '#f59e0b', color: '#b45309' }}
                  onClick={() => unlockMutation.mutate()} disabled={unlockMutation.isPending}>
                  {unlockMutation.isPending ? 'Unlocking...' : '🔓 Unlock to Draft'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, paddingBottom: 40, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setForm({})
                }}
              >
                Clear
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                style={{ minWidth: 150 }}
              >
                {saveMutation.isPending ? '⏳ Saving...' : '💾 Save Draft'}
              </button>
              <button
                className="btn btn-success"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !existing?.data?.data}
                title={!existing?.data?.data ? 'Save draft first' : ''}
              >
                {submitMutation.isPending ? 'Submitting...' : '✓ Submit for Approval'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

