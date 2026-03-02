// src/components/layout/Layout.jsx
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { usePlant } from '../../context/PlantContext'
import { useAuth } from '../../context/AuthContext'

const TITLES = {
  '/dashboard':          'Dashboard',
  '/data-entry/power':  'Power Generation Entry',
  '/data-entry/fuel':   'Fuel & Performance Entry',
  '/data-entry/scada':  'SCADA Upload',
  '/approvals':         'Approvals',
  '/reports':           'DGR Reports',
  '/hq':                'HQ Fleet View',
  '/admin/plant-config':'Plant Configuration',
}

function todayStr() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  })
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { selectedPlant } = usePlant()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const title = TITLES[location.pathname] || 'DGR Portal'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-breadcrumb">
            <span className="tb-crumb">{selectedPlant?.short_name || 'SEPC'}</span>
            <span className="tb-sep">›</span>
            <span className="tb-current">{title}</span>
          </div>
          <div className="topbar-date mono">{todayStr()}</div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/data-entry/scada')}>
              ⬆ Upload SCADA
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/data-entry/power')}>
              + New Entry
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="page-wrap">
          <Outlet />
        </div>
      </div>

      <style>{`
        .topbar {
          height: var(--topbar-h); background: var(--card);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; padding: 0 28px;
          gap: 16px; flex-shrink: 0;
        }
        .topbar-breadcrumb { display: flex; align-items: center; gap: 8px; flex: 1; }
        .tb-crumb   { font-size: 13px; color: var(--muted); font-weight: 500; }
        .tb-sep     { color: var(--border); }
        .tb-current { font-size: 13px; color: var(--text); font-weight: 600; }
        .topbar-date {
          font-size: 11px; color: var(--muted);
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 6px; padding: 5px 10px;
        }
        .topbar-actions { display: flex; align-items: center; gap: 8px; }

        /* Sidebar styles */
        .sidebar {
          width: var(--sidebar-w); min-height: 100vh;
          background: var(--sidebar); display: flex;
          flex-direction: column; flex-shrink: 0;
          transition: width 0.25s ease; overflow: hidden;
        }
        .sidebar.collapsed { width: var(--sidebar-collapsed, 68px); }
        .sidebar.collapsed .sb-brand-text,
        .sidebar.collapsed .sb-plant-info,
        .sidebar.collapsed .sb-plant-caret,
        .sidebar.collapsed .sb-item-label,
        .sidebar.collapsed .sb-section,
        .sidebar.collapsed .sb-user-info,
        .sidebar.collapsed .sb-user-menu,
        .sidebar.collapsed .sb-collapse-label { display: none; }
        .sidebar.collapsed .sb-collapse-icon { transform: rotate(180deg); }

        .sb-brand {
          display: flex; align-items: center; gap: 12px;
          padding: 0 18px; height: var(--topbar-h);
          border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
        }
        .sb-logo {
          width: 34px; height: 34px; border-radius: 8px;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .sb-brand-name { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; }
        .sb-brand-sub  { font-size: 10px; color: var(--sb-text); white-space: nowrap; font-family: 'JetBrains Mono', monospace; }

        .sb-plant {
          margin: 10px 10px 4px; background: var(--sidebar2);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 10px;
          padding: 10px 12px; cursor: pointer;
          display: flex; align-items: center; gap: 10px; flex-shrink: 0; overflow: hidden;
        }
        .sb-plant:hover { background: rgba(255,255,255,0.05); }
        .sb-plant-icon { font-size: 16px; flex-shrink: 0; }
        .sb-plant-name { font-size: 12px; font-weight: 600; color: #dce8f5; white-space: nowrap; }
        .sb-plant-sub  { font-size: 10px; color: var(--sb-text); white-space: nowrap; font-family: 'JetBrains Mono', monospace; }
        .sb-plant-caret{ color: var(--sb-text); font-size: 10px; }
        .sb-plant-info { flex: 1; overflow: hidden; }

        .sb-plant-dropdown {
          margin: 0 10px 8px; background: var(--sidebar2);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden;
        }
        .sb-plant-option {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; cursor: pointer; transition: background 0.15s;
        }
        .sb-plant-option:hover  { background: rgba(255,255,255,0.05); }
        .sb-plant-option.active { background: var(--sb-active-bg); }
        .sb-plant-option-name { font-size: 12px; font-weight: 600; color: #dce8f5; }
        .sb-plant-option-sub  { font-size: 10px; color: var(--sb-text); }

        .sb-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 0; }
        .sb-nav::-webkit-scrollbar { width: 3px; }
        .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        .sb-section {
          padding: 12px 14px 4px; font-size: 9.5px; font-weight: 600;
          letter-spacing: 2px; text-transform: uppercase;
          color: rgba(143,163,189,0.5); white-space: nowrap;
        }
        .sb-item {
          display: flex; align-items: center; gap: 12px;
          padding: 9px 14px; margin: 1px 8px; border-radius: 9px;
          cursor: pointer; transition: background 0.15s;
          text-decoration: none; position: relative;
        }
        .sb-item:hover { background: var(--sb-hover); }
        .sb-item.active { background: var(--sb-active-bg); }
        .sb-item.active::before {
          content: ''; position: absolute; left: -8px; top: 50%;
          transform: translateY(-50%); width: 4px; height: 20px;
          background: var(--sb-active); border-radius: 0 3px 3px 0;
        }
        .sb-item-icon  { width: 20px; text-align: center; font-size: 16px; color: var(--sb-text); flex-shrink: 0; }
        .sb-item-label { font-size: 13px; font-weight: 500; color: var(--sb-text); white-space: nowrap; flex: 1; }
        .sb-item:hover .sb-item-label,
        .sb-item:hover .sb-item-icon,
        .sb-item.active .sb-item-label,
        .sb-item.active .sb-item-icon { color: #c8ddf0; }
        .sb-item.active .sb-item-icon,
        .sb-item.active .sb-item-label { color: var(--sb-active); }

        .sb-user {
          padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; gap: 10px; flex-shrink: 0; overflow: hidden;
        }
        .sb-avatar {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .sb-user-name { font-size: 12px; font-weight: 600; color: #c8ddf0; white-space: nowrap; }
        .sb-user-role { font-size: 10px; color: var(--sb-text); white-space: nowrap; text-transform: capitalize; }
        .sb-user-menu { color: var(--sb-text); font-size: 16px; cursor: pointer; flex-shrink: 0; }
        .sb-user-menu:hover { color: var(--red-lt); }

        .sb-collapse {
          padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; gap: 12px; cursor: pointer; flex-shrink: 0;
        }
        .sb-collapse:hover { background: var(--sb-hover); }
        .sb-collapse-icon  { width: 20px; text-align: center; font-size: 14px; color: var(--sb-text); flex-shrink: 0; transition: transform 0.25s; }
        .sb-collapse-label { font-size: 12px; color: var(--sb-text); white-space: nowrap; }
      `}</style>
    </div>
  )
}
