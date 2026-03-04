// src/api/client.js
import axios from 'axios'

// ── Base URL resolution ──────────────────────────────────────────────────────
// In production (Railway), VITE_API_URL points to the single API Gateway.
// In development, each service runs on its own local port.
const GATEWAY = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// When deployed, ALL traffic goes through the gateway (one URL).
// In dev, we hit each service directly via gateway.
const IS_PROD = !!import.meta.env.VITE_API_URL

// Force everything through gateway port 3000 even locally to match production behavior.
const AUTH_BASE = IS_PROD ? GATEWAY : 'http://localhost:3000'
const PLANT_BASE = IS_PROD ? GATEWAY : 'http://localhost:3000'
const DATA_ENTRY_BASE = IS_PROD ? GATEWAY : 'http://localhost:3000'
const DGR_BASE = IS_PROD ? GATEWAY : 'http://localhost:3000'
const REPORTS_BASE = IS_PROD ? GATEWAY : 'http://localhost:3000'

// ── Auth Service ─────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: AUTH_BASE + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Plant Config Service ─────────────────────────────────────────────────────
const plantclient = axios.create({
  baseURL: PLANT_BASE + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Data Entry Service ───────────────────────────────────────────────────────
const dataEntryClient = axios.create({
  baseURL: DATA_ENTRY_BASE + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── DGR Compute Service ──────────────────────────────────────────────────────
const dgrClient = axios.create({
  baseURL: DGR_BASE + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Report Export — served from dgr-compute (port 3004) ─────────────────────
const reportsClient = axios.create({
  baseURL: REPORTS_BASE + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token attachment ── all clients ─────────────────────────────────────────
const attachToken = (config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
}
client.interceptors.request.use(attachToken)
plantclient.interceptors.request.use(attachToken)
dataEntryClient.interceptors.request.use(attachToken)
dgrClient.interceptors.request.use(attachToken)
reportsClient.interceptors.request.use(attachToken)

// ── Auto-refresh on 401 ── reusable factory ──────────────────────────────────
const makeRefreshInterceptor = (axiosInstance) => {
  axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true
        try {
          const { data } = await axios.post(
            AUTH_BASE + '/api/auth/refresh',
            {},
            { withCredentials: true }
          )
          localStorage.setItem('accessToken', data.data.accessToken)
          original.headers.Authorization = `Bearer ${data.data.accessToken}`
          return axiosInstance(original)
        } catch {
          localStorage.removeItem('accessToken')
          window.location.href = '/login'
        }
      }
      return Promise.reject(err)
    }
  )
}

makeRefreshInterceptor(client)
makeRefreshInterceptor(plantclient)
makeRefreshInterceptor(dataEntryClient)
makeRefreshInterceptor(dgrClient)
makeRefreshInterceptor(reportsClient)

export { plantclient, dataEntryClient, dgrClient, reportsClient }
export default client
