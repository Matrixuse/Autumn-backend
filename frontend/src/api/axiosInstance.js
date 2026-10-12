import axios from 'axios'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const productionApiOrigin = 'https://autumn-backend.namans2k04.workers.dev'
const useProductionFallback = import.meta.env.PROD && (!configuredBaseUrl || configuredBaseUrl.includes('.run.app'))
const apiOrigin = useProductionFallback ? productionApiOrigin : configuredBaseUrl
const baseURL = apiOrigin
  ? (apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`)
  : '/api'

const axiosInstance = axios.create({ baseURL })

axiosInstance.interceptors.request.use((config) => {
  return config
})

export default axiosInstance