import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** @typedef {{ success: true, data: T }} ApiSuccess @template T */
/** @typedef {Error & { status: number | null, code: string | null, details: unknown }} ApiError */

const SESSION_TOKEN_KEY = 'autumn.session-token.v1'
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || ''

export const apiBaseUrl = configuredBaseUrl
  ? (configuredBaseUrl.endsWith('/api') ? configuredBaseUrl : `${configuredBaseUrl}/api`)
  : ''

export const persistSessionToken = async (token) => {
  if (token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, token)
  else await AsyncStorage.removeItem(SESSION_TOKEN_KEY)
}

export const readSessionToken = async () => AsyncStorage.getItem(SESSION_TOKEN_KEY)

export const apiClient = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: 20000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured. Copy .env.example to .env and set the API URL.')
  const token = await readSessionToken()
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const token = response.headers?.['x-session-token'] || response.headers?.['X-Session-Token']
    if (token) {
      void persistSessionToken(token)
    }
    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      await persistSessionToken(null)
    }
    const status = error.response?.status ?? null
    const message = error.response?.data?.message
      || error.response?.data?.error
      || (error.code === 'ECONNABORTED' ? 'The request timed out. Try again.' : '')
      || (status ? `Request failed (${status}).` : 'Unable to reach Autumn. Check your connection.')
    const normalized = new Error(message)
    normalized.name = 'ApiError'
    normalized.status = status
    normalized.code = error.code || null
    normalized.details = error.response?.data || null
    return Promise.reject(normalized)
  },
)
