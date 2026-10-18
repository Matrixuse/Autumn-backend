import axios from 'axios'

const SESSION_TOKEN_KEY = 'autumn.session-token.v1'
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const productionApiOrigin = 'https://autumn-backend.getvoroa.com'
const useProductionFallback = import.meta.env.PROD && (
  !configuredBaseUrl || configuredBaseUrl.includes('.run.app') || configuredBaseUrl.includes('.workers.dev')
)
const apiOrigin = useProductionFallback ? productionApiOrigin : configuredBaseUrl
const baseURL = apiOrigin
  ? (apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`)
  : '/api'

const axiosInstance = axios.create({ baseURL, withCredentials: true })

axiosInstance.interceptors.request.use((config) => {
  const isAuthSubmission = /^\/auth\/(?:login|google|register)(?:\/|$)/.test(config.url || '')
  const token = isAuthSubmission ? null : localStorage.getItem(SESSION_TOKEN_KEY)
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

axiosInstance.interceptors.response.use(
  (response) => {
    const token = response.headers?.['x-session-token']
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token)
    return response
  },
  (error) => {
    const requestToken = error.config?.headers?.get?.('Authorization') || error.config?.headers?.Authorization
    if (error.response?.status === 401 && requestToken) localStorage.removeItem(SESSION_TOKEN_KEY)
    return Promise.reject(error)
  },
)

export default axiosInstance