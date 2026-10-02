import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)
const PROFILE_KEY = 'autumn.cached-profile.v1'

const persistUser = async (user) => {
  if (user) await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user))
  else await SecureStore.deleteItemAsync(PROFILE_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [startupError, setStartupError] = useState('')

  useEffect(() => {
    let active = true

    const restoreSession = async () => {
      let cachedUser = null
      try {
        const cachedProfile = await SecureStore.getItemAsync(PROFILE_KEY)
        cachedUser = cachedProfile ? JSON.parse(cachedProfile) : null
        if (active && cachedUser) setUser(cachedUser)
      } catch {
        await SecureStore.deleteItemAsync(PROFILE_KEY).catch(() => {})
      }

      try {
        const profile = await authApi.getProfile()
        if (!active) return
        setUser(profile)
        await persistUser(profile)
        setStartupError('')
      } catch (error) {
        if (!active) return
        if (error.status === 401 || error.status === 400) {
          setUser(null)
          await persistUser(null)
        } else if (!cachedUser) {
          setUser(null)
          setStartupError(error.message)
        } else {
          setStartupError('Offline: showing your last saved account.')
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    restoreSession()
    return () => { active = false }
  }, [])

  const completeSignIn = async (request) => {
    const nextUser = await request
    await persistUser(nextUser)
    setUser(nextUser)
    setStartupError('')
    return nextUser
  }

  const signIn = (credentials) => completeSignIn(authApi.login(credentials))
  const signUp = (credentials) => completeSignIn(authApi.register(credentials))
  const signInWithGoogle = (idToken) => completeSignIn(authApi.loginWithGoogle(idToken))
  const updateProfile = async (updates) => {
    const nextUser = { ...user, ...updates }
    await persistUser(nextUser)
    setUser(nextUser)
    return nextUser
  }

  const signOut = async () => {
    try {
      await authApi.logout()
    } finally {
      await persistUser(null)
      setUser(null)
      setStartupError('')
    }
  }

  const value = useMemo(() => ({
    user,
    isLoading,
    startupError,
    isAuthenticated: Boolean(user),
    signIn,
    signUp,
    signInWithGoogle,
    updateProfile,
    signOut,
  }), [isLoading, startupError, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}