import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from './client'

const DEVICE_ID_KEY = 'autumn_connect_device_id.v1'

export const getConnectDeviceId = async () => {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = `android-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

const unwrap = (response) => {
  if (!response.data?.success) throw new Error(response.data?.message || 'Autumn Connect request failed.')
  return response.data.data
}

export const registerConnectDevice = async (deviceId) => unwrap(await apiClient.post('/connect/devices/register', {
  deviceId,
  name: 'Autumn on Android',
  platform: 'android'
}))
export const listConnectDevices = async (deviceId) => unwrap(await apiClient.get('/connect/devices', { params: { deviceId } }))
export const heartbeatConnectDevice = async (deviceId) => unwrap(await apiClient.post('/connect/devices/heartbeat', { deviceId }))
export const updateConnectDevice = async (deviceId, updates) => unwrap(await apiClient.patch(`/connect/devices/${encodeURIComponent(deviceId)}`, updates))
export const revokeConnectDevice = async (deviceId) => unwrap(await apiClient.delete(`/connect/devices/${encodeURIComponent(deviceId)}`))
export const savePlaybackSnapshot = async (deviceId, snapshot) => unwrap(await apiClient.put('/connect/session', { deviceId, snapshot }))
export const createPlaybackHandoff = async (sourceDeviceId, targetDeviceId) => unwrap(await apiClient.post('/connect/handoffs', { sourceDeviceId, targetDeviceId }))
export const getPendingPlaybackHandoff = async (deviceId) => unwrap(await apiClient.get('/connect/handoffs/pending', { params: { deviceId } }))
export const getActivePlaybackHandoff = async (deviceId) => unwrap(await apiClient.get('/connect/handoffs/active', { params: { deviceId } }))
export const getPlaybackHandoff = async (handoffId, deviceId) => unwrap(await apiClient.get(`/connect/handoffs/${encodeURIComponent(handoffId)}`, { params: { deviceId } }))
export const actOnPlaybackHandoff = async (handoffId, deviceId, action, snapshot) => unwrap(await apiClient.post(`/connect/handoffs/${encodeURIComponent(handoffId)}/action`, { deviceId, action, ...(snapshot ? { snapshot } : {}) }))