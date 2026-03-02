// src/pages/data-entry/SCADAUpload.jsx
import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usePlant } from '../../context/PlantContext'
import { dataEntry } from '../../api'

const today = new Date().toISOString().split('T')[0]

export default function SCADAUpload() {
  const { selectedPlant } = usePlant()
  const plantId = selectedPlant?.id
  const [date, setDate]       = useState(today)
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragover, setDragover] = useState(false)
  const [msg, setMsg]         = useState(null)
  const fileRef               = useRef()

  const uploadMutation = useMutation({
    mutationFn: (formData) => dataEntry.uploadSCADA(plantId, formData),
    onSuccess: (res) => {
      setPreview(res.data.data)
      setMsg({ type: 'success', text: res.data.data.message || 'File processed successfully' })
    },
    onError: (err) => setMsg({ type: 'error', text: err.response?.data?.message || 'Upload failed' }),
  })

  const confirmMutation = useMutation({
    mutationFn: () => dataEntry.confirmSCADA(plantId, {
      entryDate: date,
      mappedData: preview?.preview?.mappedData || {},
      manualOverrides: {},
    }),
    onSuccess: () => setMsg({ type: 'success', text: '✓ SCADA data confirmed and ready to save as Power Entry' }),
  })

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setPreview(null)
    setMsg(null)
  }

  const handleUpload = () => {
    if (!file || !plantId) return
    const fd = new FormData()
    fd.append('scadaFile', file)
    fd.append('entryDate', date)
    uploadMutation.mutate(fd)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragover(false)
    handleFile(e.dataTransfer.files[0])
  }

  const MappedRow = ({ label, val, unit }) => (
    <tr>
      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{label}</td>
      <td className="mono" style={{ textAlign: 'right', color: 'var(--blue)', fontWeight: 600 }}>
        {val != null ? parseFloat(val).toFixed(4) : '—'}
      </td>
      <td style={{ color: 'var(--muted)', fontSize: 11 }}>{unit}</td>
    </tr>
  )

  return (
    <div>
      <div className="page-title">📤 SCADA Upload</div>
      <div className="page-sub">Upload your SCADA CSV/Excel export — column mapping applied automatically</div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Date */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Entry Date</label>
              <input className="form-input" type="date" value={date} max={today}
                onChange={e => setDate(e.target.value)} />
            </div>
            {selectedPlant && (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Plant: <strong>{selectedPlant.name}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {!plantId ? (
        <div className="alert alert-info">ℹ Select a plant from the sidebar.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Upload zone */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-hdr"><div className="card-title">📁 Select File</div></div>
              <div className="card-body">
                <div
                  className={`upload-zone${dragover ? ' dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragover(true) }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                    {file ? file.name : 'Drop SCADA file here'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB · Click to change`
                      : 'Supports CSV, XLS, XLSX · Click or drag to upload'}
                  </div>
                  <input
                    ref={fileRef} type="file" style={{ display: 'none' }}
                    accept=".csv,.xls,.xlsx"
                    onChange={e => handleFile(e.target.files[0])}
                  />
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? '⏳ Processing...' : '⬆ Upload & Preview'}
            </button>
          </div>

          {/* Preview */}
          <div>
            {preview ? (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title">👁 Mapped Preview</div>
                  <span className={`tag ${preview.preview.unmapped.length === 0 ? 'tag-done' : 'tag-warn'}`}>
                    {preview.preview.unmapped.length === 0 ? 'All Mapped' : `${preview.preview.unmapped.length} Unmapped`}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 0, maxHeight: 400, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Portal Field</th><th style={{ textAlign: 'right' }}>Value</th><th>Unit</th></tr></thead>
                    <tbody>
                      {Object.entries(preview.preview.mappedData).map(([key, val]) => (
                        <MappedRow key={key} label={key} val={val} unit="" />
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.preview.unmapped.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                    <div className="alert alert-warn" style={{ marginBottom: 0 }}>
                      ⚠ {preview.preview.unmapped.length} fields not mapped —
                      configure column mappings in Plant Config to fix this.
                    </div>
                  </div>
                )}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-success"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? 'Confirming...' : '✓ Confirm Import'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ border: '2px dashed var(--border)' }}>
                <div className="card-body" style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👁</div>
                  <div style={{ fontSize: 13 }}>Mapped preview will appear here after upload</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
