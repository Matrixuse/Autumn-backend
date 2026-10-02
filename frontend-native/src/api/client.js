import axios from 'axios'

/** @typedef {{ success: true, data: T }} ApiSuccess @template T */
/** @typedef {Error & { status: number | null, code: string | null, details: unknown }} ApiError */

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || ''

export const apiBaseUrl = configuredBaseUrl
  ? (configuredBaseUrl.endsWith('/api') ? configuredBaseUrl : `${configuredBaseUrl}/api`)
  : ''

export const apiClient = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: 20000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured. Copy .env.example to .env and set the API URL.')
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
