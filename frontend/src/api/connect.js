import axiosInstance from './axiosInstance'

const DEVICE_STORAGE_KEY = 'autumn_connect_device_id'

export const getConnectDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY)
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId)
  }
  return deviceId
}

const unwrap = (response) => {
  const payload = response.data
  if (!payload?.success) throw new Error(payload?.message || 'Autumn Connect request failed.')
  return payload.data
}

export const getConnectErrorMessage = (error, fallback) => {
  if (error?.response?.status === 404) {
    return 'Continue Anywhere is not available on the connected server yet. The backend device API must be deployed before device settings can be changed.'
  }
  return error?.response?.data?.message || error?.message || fallback
}

const platform = () => /Android/i.test(navigator.userAgent) ? 'android' : 'web'
const defaultName = () => {
  if (platform() === 'android') return 'Autumn on Android'
  const browser = /Edg/i.test(navigator.userAgent) ? 'Edge' : /Firefox/i.test(navigator.userAgent) ? 'Firefox' : /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Browser'
  const operatingSystem = navigator.platform?.includes('Mac') ? 'Mac' : navigator.platform?.includes('Win') ? 'Windows' : 'Desktop'
  return `${browser} on ${operatingSystem}`
}

export const registerConnectDevice = async (deviceId = getConnectDeviceId()) => unwrap(await axiosInstance.post('/connect/devices/register', { deviceId, name: defaultName(), platform: platform() }, { withCredentials: true }))
export const listConnectDevices = async (deviceId = getConnectDeviceId()) => unwrap(await axiosInstance.get('/connect/devices', { params: { deviceId }, withCredentials: true }))
export const heartbeatConnectDevice = async (deviceId = getConnectDeviceId()) => unwrap(await axiosInstance.post('/connect/devices/heartbeat', { deviceId }, { withCredentials: true }))
export const updateConnectDevice = async (deviceId, updates) => unwrap(await axiosInstance.patch(`/connect/devices/${encodeURIComponent(deviceId)}`, updates, { withCredentials: true }))
export const revokeConnectDevice = async (deviceId) => unwrap(await axiosInstance.delete(`/connect/devices/${encodeURIComponent(deviceId)}`, { withCredentials: true }))
export const savePlaybackSnapshot = async (deviceId, snapshot) => unwrap(await axiosInstance.put('/connect/session', { deviceId, snapshot }, { withCredentials: true }))
export const createPlaybackHandoff = async (sourceDeviceId, targetDeviceId) => unwrap(await axiosInstance.post('/connect/handoffs', { sourceDeviceId, targetDeviceId }, { withCredentials: true }))
export const getPendingPlaybackHandoff = async (deviceId) => unwrap(await axiosInstance.get('/connect/handoffs/pending', { params: { deviceId }, withCredentials: true }))
export const getActivePlaybackHandoff = async (deviceId) => unwrap(await axiosInstance.get('/connect/handoffs/active', { params: { deviceId }, withCredentials: true }))
export const getPlaybackHandoff = async (handoffId, deviceId) => unwrap(await axiosInstance.get(`/connect/handoffs/${encodeURIComponent(handoffId)}`, { params: { deviceId }, withCredentials: true }))
export const actOnPlaybackHandoff = async (handoffId, deviceId, action, snapshot) => unwrap(await axiosInstance.post(`/connect/handoffs/${encodeURIComponent(handoffId)}/action`, { deviceId, action, ...(snapshot ? { snapshot } : {}) }, { withCredentials: true }))