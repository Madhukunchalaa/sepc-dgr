// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PlantProvider } from './context/PlantContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import Dashboard from './pages/dashboard/Dashboard'
import PowerEntry from './pages/data-entry/PowerEntry'
import FuelEntry from './pages/data-entry/FuelEntry'
import WaterEntry from './pages/data-entry/WaterEntry'
import PerformanceEntry from './pages/data-entry/PerformanceEntry'
import SchedulingEntry from './pages/data-entry/SchedulingEntry'
import OperationsEntry from './pages/data-entry/OperationsEntry'
import SCADAUpload from './pages/data-entry/SCADAUpload'
import ApprovalsPage from './pages/dashboard/ApprovalsPage'
import ReportsPage from './pages/reports/ReportsPage'
import DgrReportView from './pages/reports/DgrReportView'
import PlantConfig from './pages/admin/PlantConfig'
import HQFleet from './pages/dashboard/HQFleet'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="data-entry/power" element={<PowerEntry />} />
        <Route path="data-entry/fuel" element={<FuelEntry />} />
        <Route path="data-entry/performance" element={<PerformanceEntry />} />
        <Route path="data-entry/water" element={<WaterEntry />} />
        <Route path="data-entry/scheduling" element={<SchedulingEntry />} />
        <Route path="data-entry/operations" element={<OperationsEntry />} />
        <Route path="data-entry/scada" element={<SCADAUpload />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/view" element={<DgrReportView />} />
        <Route path="hq" element={<HQFleet />} />
        <Route path="admin/plant-config" element={<PlantConfig />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <PlantProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PlantProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
