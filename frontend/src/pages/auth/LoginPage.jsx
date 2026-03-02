// src/pages/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⚡</div>
        <h1 style={styles.title}>DGR Portal</h1>
        <p style={styles.sub}>SEPC Power Private Limited</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@sepcpower.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={styles.hint}>
          Default: admin@sepcpower.com / Admin@1234
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f1923 0%, #162030 100%)',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '40px 36px',
    width: '100%', maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  logo: {
    width: 56, height: 56, borderRadius: 14,
    background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: 700, color: '#1e2a3b', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#8a97ab', marginBottom: 28 },
  hint:  { fontSize: 11, color: '#8a97ab', marginTop: 20, textAlign: 'center' },
}
