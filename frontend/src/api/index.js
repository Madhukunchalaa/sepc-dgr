// src/api/index.js
import client, { plantclient, dataEntryClient, dgrClient, reportsClient } from './client'

// ── Auth (port 3001) ──
export const auth = {
  login: (data) => client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  me: () => client.get('/auth/me'),
  changePassword: (data) => client.post('/auth/change-password', data),
  refresh: () => client.post('/auth/refresh'),
}

// ── Plants (port 3002) ──
export const plants = {
  list: () => plantclient.get('/plants'),
  get: (id) => plantclient.get(`/plants/${id}`),
  create: (data) => plantclient.post('/plants', data),
  update: (id, data) => plantclient.patch(`/plants/${id}`, data),
  meters: (id) => plantclient.get(`/plants/${id}/meters`),
  submissionStatus: (id, date) => dataEntryClient.get(`/data-entry/submission/${id}?date=${date}`),
}

// ── Data Entry (port 3003) ──
export const dataEntry = {
  // Power
  getPower: (plantId, date) => dataEntryClient.get(`/data-entry/power/${plantId}/${date}`),
  savePower: (data) => dataEntryClient.post('/data-entry/power', data),
  submitPower: (data) => dataEntryClient.post('/data-entry/power/submit', data),
  approvePower: (data) => dataEntryClient.post('/data-entry/power/approve', data),
  powerHistory: (plantId, params) => dataEntryClient.get(`/data-entry/power/${plantId}/history`, { params }),

  // Fuel
  getFuel: (plantId, date) => dataEntryClient.get(`/data-entry/fuel/${plantId}/${date}`),
  saveFuel: (data) => dataEntryClient.post('/data-entry/fuel', data),
  submitFuel: (data) => dataEntryClient.post('/data-entry/fuel/submit', data),
  approveFuel: (data) => dataEntryClient.post('/data-entry/fuel/approve', data),

  // Water
  getWater: (plantId, date) => dataEntryClient.get(`/data-entry/water/${plantId}/${date}`),
  saveWater: (data) => dataEntryClient.post('/data-entry/water', data),
  submitWater: (data) => dataEntryClient.post('/data-entry/water/submit', data),
  approveWater: (data) => dataEntryClient.post('/data-entry/water/approve', data),

  // Performance
  getPerformance: (plantId, date) => dataEntryClient.get(`/data-entry/performance/${plantId}/${date}`),
  savePerformance: (data) => dataEntryClient.post('/data-entry/performance', data),
  submitPerformance: (data) => dataEntryClient.post('/data-entry/performance/submit', data),
  approvePerformance: (data) => dataEntryClient.post('/data-entry/performance/approve', data),

  // Scheduling
  getScheduling: (plantId, date) => dataEntryClient.get(`/data-entry/scheduling/${plantId}/${date}`),
  saveScheduling: (data) => dataEntryClient.post('/data-entry/scheduling', data),
  submitScheduling: (data) => dataEntryClient.post('/data-entry/scheduling/submit', data),
  approveScheduling: (data) => dataEntryClient.post('/data-entry/scheduling/approve', data),

  // Availability
  getAvailability: (plantId, date) => dataEntryClient.get(`/data-entry/availability/${plantId}/${date}`),
  saveAvailability: (data) => dataEntryClient.post('/data-entry/availability', data),
  submitAvailability: (data) => dataEntryClient.post('/data-entry/availability/submit', data),
  approveAvailability: (data) => dataEntryClient.post('/data-entry/availability/approve', data),

  // Ash
  getAsh: (plantId, date) => dataEntryClient.get(`/data-entry/ash/${plantId}/${date}`),
  saveAsh: (data) => dataEntryClient.post('/data-entry/ash/upsert', data),

  // DSM
  getDsm: (plantId, date) => dataEntryClient.get(`/data-entry/dsm/${plantId}/${date}`),
  saveDsm: (data) => dataEntryClient.post('/data-entry/dsm/upsert', data),

  // Operations
  getOperations: (plantId, date) => dataEntryClient.get(`/data-entry/operations/${plantId}/${date}`),
  saveOperations: (data) => dataEntryClient.post('/data-entry/operations', data),
  submitOperations: (data) => dataEntryClient.post('/data-entry/operations/submit', data),
  approveOperations: (data) => dataEntryClient.post('/data-entry/operations/approve', data),

  // TAQA Specific
  getTaqaEntry: (plantId, date) => dataEntryClient.get(`/data-entry/taqa/${plantId}/${date}`),
  saveTaqaEntry: (plantId, date, data) => dataEntryClient.post(`/data-entry/taqa/${plantId}/${date}`, data),
  submitTaqaEntry: (plantId, date) => dataEntryClient.post(`/data-entry/taqa/${plantId}/${date}/submit`),
  approveTaqaEntry: (plantId, date) => dataEntryClient.post(`/data-entry/taqa/${plantId}/${date}/approve`),

  // Anpara Specific
  getAnparaEntry: (plantId, date) => dataEntryClient.get(`/data-entry/anpara/${plantId}/${date}`),
  saveAnparaEntry: (plantId, date, data) => dataEntryClient.post(`/data-entry/anpara/${plantId}/${date}`, data),
  submitAnparaEntry: (plantId, date) => dataEntryClient.post(`/data-entry/anpara/${plantId}/${date}/submit`),
  approveAnparaEntry: (plantId, date) => dataEntryClient.post(`/data-entry/anpara/${plantId}/${date}/approve`),

  // SCADA
  getMappings: (plantId) => dataEntryClient.get(`/data-entry/scada/mappings/${plantId}`),
  saveMappings: (plantId, data) => dataEntryClient.post(`/data-entry/scada/mappings/${plantId}`, data),
  uploadSCADA: (plantId, formData) => dataEntryClient.post(`/data-entry/scada/upload/${plantId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  confirmSCADA: (plantId, data) => dataEntryClient.post(`/data-entry/scada/confirm/${plantId}`, data),

  // Submission status
  submissionStatus: (plantId, date) => dataEntryClient.get(`/data-entry/submission/${plantId}?date=${date}`),
  pendingApprovals: () => dataEntryClient.get('/data-entry/submission/pending/approvals'),
}

// ── DGR Compute (port 3004) ──
export const dgr = {
  get: (plantId, date) => dgrClient.get(`/dgr/${plantId}/${date}`),
  fleet: (date) => dgrClient.get(`/dgr/fleet/${date}`),
  history: (plantId, params) => dgrClient.get(`/dgr/${plantId}/history`, { params }),
}

// ── Reports (port 3005) ──
export const reports = {
  downloadExcel: (plantId, date) =>
    reportsClient.get(`/reports/dgr/excel/${plantId}/${date}`, { responseType: 'blob' }),
  downloadSAP: (plantId, date) =>
    reportsClient.get(`/reports/sap/${plantId}/${date}`, { responseType: 'blob' }),
}
