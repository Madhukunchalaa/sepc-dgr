// src/api/client.js
import axios from 'axios'

// ── Auth Service (port 3001) ──
const client = axios.create({
  baseURL: 'http://localhost:3001/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Plant Config Service (port 3002) ──
const plantclient = axios.create({
  baseURL: 'http://localhost:3002/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Data Entry Service (port 3003) ──
const dataEntryClient = axios.create({
  baseURL: 'http://localhost:3003/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── DGR Compute Service (port 3004) ──
const dgrClient = axios.create({
  baseURL: 'http://localhost:3004/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Report Export — served from dgr-compute (port 3004) ──
const reportsClient = axios.create({
  baseURL: 'http://localhost:3004/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token attachment ── all clients ──
const attachToken = (config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
client.interceptors.request.use(attachToken)
plantclient.interceptors.request.use(attachToken)
dataEntryClient.interceptors.request.use(attachToken)
dgrClient.interceptors.request.use(attachToken)
reportsClient.interceptors.request.use(attachToken)

// ── Auto-refresh on 401 ── reusable factory ──
const makeRefreshInterceptor = (axiosInstance) => {
  axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true
        try {
          const { data } = await axios.post(
            'http://localhost:3001/api/auth/refresh',
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
