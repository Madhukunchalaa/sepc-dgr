// src/components/ExcelUploadBtn.jsx
// Reusable "Download Template / Upload Excel" button pair for all data-entry tabs
import { useRef, useState } from 'react'
import { downloadTemplate, parseExcel } from '../utils/moduleExcel'

export default function ExcelUploadBtn({ fields, currentData, onImport, filename, entryDate }) {
  const fileRef = useRef()
  const [parsing, setParsing] = useState(false)
  const [err, setErr] = useState(null)

  const handleDownload = () => {
    downloadTemplate(fields, currentData || {}, filename || 'template.xlsx', entryDate)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''  // reset so same file can be re-uploaded
    setParsing(true)
    setErr(null)
    try {
      const data = await parseExcel(file, fields)
      if (Object.keys(data).length === 0) {
        setErr('No matching fields found. Use the downloaded template.')
      } else {
        onImport(data)
      }
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={handleDownload}
          title="Download blank Excel template for this module"
        >
          ⬇ Template
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px', background: parsing ? undefined : '#f0fdf4', borderColor: '#16a34a', color: '#16a34a' }}
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          title="Upload filled Excel to populate form"
        >
          {parsing ? '⏳ Reading...' : '📂 Upload Excel'}
        </button>
        <input ref={fileRef} type="file" accept=".xls,.xlsx,.xlsm" style={{ display: 'none' }} onChange={handleUpload} />
      </div>
      {err && <div style={{ fontSize: 11, color: '#dc2626' }}>⚠ {err}</div>}
    </div>
  )
}
