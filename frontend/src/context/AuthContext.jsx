// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      auth.me()
        .then(({ data }) => setUser(data.data))
        .catch(() => localStorage.removeItem('accessToken'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const { data } = await auth.login({ email, password })
    localStorage.setItem('accessToken', data.data.accessToken)
    setUser(data.data.user)
    return data.data.user
  }

  const logout = async () => {
    await auth.logout().catch(() => { })
    localStorage.removeItem('accessToken')
    setUser(null)
  }

  const isRole = (...roles) => roles.includes(user?.role)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
