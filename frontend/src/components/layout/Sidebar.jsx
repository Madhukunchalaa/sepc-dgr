// src/components/layout/Sidebar.jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePlant } from '../../context/PlantContext'

const NAV = [
  { section: 'Main' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/reports/view', icon: '🔍', label: 'DGR Report Viewer' },
  { section: 'Data Entry' },
  { to: '/data-entry/power', icon: '⚡', label: 'Power Generation' },
  { to: '/data-entry/fuel', icon: '🔥', label: 'Fuel' },
  { to: '/data-entry/performance', icon: '🎯', label: 'Performance' },
  { to: '/data-entry/water', icon: '💧', label: 'Water Consumption' },
  { to: '/data-entry/scheduling', icon: '⏱️', label: 'Scheduling & Avail.' },
  { to: '/data-entry/operations', icon: '📋', label: 'Operations Log' },
  { to: '/data-entry/ash', icon: '💨', label: 'Ash Production' },
  { to: '/data-entry/dsm', icon: '💰', label: 'DSM Accounting' },
  { to: '/data-entry/scada', icon: '📤', label: 'SCADA Upload' },
  { section: 'Operations' },
  { to: '/approvals', icon: '✅', label: 'Approvals', badge: 'approvals' },
  { section: 'Management' },
  { to: '/hq', icon: '🌐', label: 'HQ Fleet View', roles: ['hq_management', 'it_admin'] },
  { to: '/reports', icon: '📄', label: 'DGR Downloads' },

  { section: 'Admin' },
  { to: '/admin/plant-config', icon: '⚙️', label: 'Plant Config', roles: ['it_admin', 'plant_admin'] },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isRole } = useAuth()
  const { plantList, selectedPlant, switchPlant } = usePlant()
  const [showPlants, setShowPlants] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>

      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-logo">⚡</div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">DGR Portal</div>
          <div className="sb-brand-sub">SEPC Power Pvt Ltd</div>
        </div>
      </div>

      {/* Plant selector */}
      <div className="sb-plant" onClick={() => setShowPlants(!showPlants)}>
        <div className="sb-plant-icon">🏭</div>
        <div className="sb-plant-info">
          <div className="sb-plant-name">{selectedPlant?.short_name || 'Select Plant'}</div>
          <div className="sb-plant-sub">{selectedPlant ? `${selectedPlant.capacity_mw} MW` : '—'}</div>
        </div>
        <div className="sb-plant-caret">{showPlants ? '▲' : '▼'}</div>
      </div>

      {/* Plant dropdown */}
      {showPlants && (
        <div className="sb-plant-dropdown">
          {plantList.map(p => (
            <div
              key={p.id}
              className={`sb-plant-option${p.id === selectedPlant?.id ? ' active' : ''}`}
              onClick={() => { switchPlant(p); setShowPlants(false) }}
            >
              <span>🏭</span>
              <div>
                <div className="sb-plant-option-name">{p.short_name}</div>
                <div className="sb-plant-option-sub">{p.location}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="sb-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return <div key={i} className="sb-section">{item.section}</div>
          }
          if (item.roles && !isRole(...item.roles)) return null
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
            >
              <div className="sb-item-icon">{item.icon}</div>
              <div className="sb-item-label">{item.label}</div>
            </NavLink>
          )
        })}
      </div>

      {/* User */}
      <div className="sb-user">
        <div className="sb-avatar">{initials}</div>
        <div className="sb-user-info">
          <div className="sb-user-name">{user?.full_name}</div>
          <div className="sb-user-role">{user?.role?.replace(/_/g, ' ')}</div>
        </div>
        <div className="sb-user-menu" onClick={handleLogout} title="Logout">⏻</div>
      </div>

      {/* Collapse toggle */}
      <div className="sb-collapse" onClick={onToggle}>
        <div className="sb-collapse-icon">◀</div>
        <div className="sb-collapse-label">Collapse</div>
      </div>

    </nav>
  )
}
