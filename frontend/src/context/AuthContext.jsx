import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as authApi from '../api/auth'
import { usePlayer } from './PlayerContext'

const AuthContext = createContext(null)
const announceAuthChange = () => window.dispatchEvent(new Event('autumn-auth-changed'))
const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('autumn_user')) || null
  } catch {
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser)
  const [loading, setLoading] = useState(() => Boolean(readStoredUser()))
  const authVersion = useRef(0)
  const { stopPlayback } = usePlayer()

  useEffect(() => {
    if (!user) return
    const requestVersion = authVersion.current
    authApi.getUser().then((response) => {
      if (requestVersion !== authVersion.current) return
      localStorage.setItem('autumn_user', JSON.stringify(response.data))
      setUser(response.data)
    }).catch((error) => {
      if (requestVersion !== authVersion.current) return
      if ([400, 401].includes(error.response?.status)) {
        localStorage.removeItem('autumn_user')
        setUser(null)
      }
    }).finally(() => {
      if (requestVersion === authVersion.current) setLoading(false)
    })
  }, [])

  const login = async (credentials) => {
    const response = await authApi.login(credentials)
    const nextUser = response.data
    authVersion.current += 1
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    setLoading(false)
    announceAuthChange()
    return nextUser
  }

  const loginWithGoogle = async (idToken) => {
    const response = await authApi.loginWithGoogle(idToken)
    const nextUser = response.data
    authVersion.current += 1
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    setLoading(false)
    announceAuthChange()
    return nextUser
  }

  const signup = async (credentials) => {
    const response = await authApi.signup(credentials)
    const nextUser = response.data
    authVersion.current += 1
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    setLoading(false)
    announceAuthChange()
    return nextUser
  }

  const logout = async () => {
    authVersion.current += 1
    stopPlayback()
    try { await authApi.logout() } finally {
      localStorage.removeItem('autumn_user')
      setUser(null)
      setLoading(false)
      announceAuthChange()
    }
  }
  const updateProfile = (updates) => {
    const nextUser = { ...user, ...updates }
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }
  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user) && !loading, login, loginWithGoogle, signup, logout, updateProfile }}>
        {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)