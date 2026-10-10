import { createContext, useContext, useState } from 'react'
import * as authApi from '../api/auth'
import { usePlayer } from './PlayerContext'

const AuthContext = createContext(null)
const announceAuthChange = () => window.dispatchEvent(new Event('autumn-auth-changed'))

export const AuthProvider = ({ children }) => {
  const [loading] = useState(false)
  const [user, setUser] = useState(() => { 
    try { 
        return JSON.parse(localStorage.getItem('autumn_user')) || null 
    } catch { 
        return null 
    } 
  })
  const { stopPlayback } = usePlayer()

  const login = async (credentials) => {
    const response = await authApi.login(credentials)
    const nextUser = response.data
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    announceAuthChange()
    return nextUser
  }

  const loginWithGoogle = async (idToken) => {
    const response = await authApi.loginWithGoogle(idToken)
    const nextUser = response.data
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    announceAuthChange()
    return nextUser
  }

  const signup = async (credentials) => {
    const response = await authApi.signup(credentials)
    const nextUser = response.data
    localStorage.setItem('autumn_user', JSON.stringify(nextUser))
    setUser(nextUser)
    announceAuthChange()
    return nextUser
  }

  const logout = async () => {
    stopPlayback()
    try { await authApi.logout() } finally {
      localStorage.removeItem('autumn_user')
      setUser(null)
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
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user), login, loginWithGoogle, signup, logout, updateProfile }}>
        {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)