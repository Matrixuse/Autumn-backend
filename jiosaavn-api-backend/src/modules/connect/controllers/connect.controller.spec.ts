import { App } from '../../../app.js'
import { AuthError } from '#modules/auth/services'
import { ConnectController, getConnectDeviceStatus, isAllowedHandoffTransition } from '#modules/connect/controllers'
import { getDatabase } from '#common/database'
import { describe, expect, it, vi } from 'vitest'

vi.mock('#common/database', () => ({
  getDatabase: vi.fn()
}))

const mockDeviceRecord = {
  userId: '507f1f77bcf86cd799439011',
  deviceId: 'mobile-device-12345678',
  name: 'Mobile',
  platform: 'android',
  createdAt: new Date(),
  lastSeenAt: new Date(),
  lastActiveAt: new Date(),
  enabled: true,
  allowReceiving: true
}

const mockDatabase = {
  collection: vi.fn(() => {
    const collection = {
      findOne: vi.fn().mockImplementation(() => Promise.resolve(mockDeviceRecord)),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 0, upsertedCount: 1 }),
      find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) })
    }
    return collection
  })
}

const createApp = (authenticated = false) => {
  const authService = {
    getUserBySession: vi.fn((token: string | undefined) => {
      if (!authenticated || token !== 'valid-session') return Promise.reject(new AuthError('Authentication required', 401))
      return Promise.resolve({ id: '507f1f77bcf86cd799439011', username: 'listener', email: 'listener@example.com', createdAt: new Date().toISOString() })
    })
  }

  vi.mocked(getDatabase).mockResolvedValue(mockDatabase as any)

  return { app: new App([new ConnectController(authService)]).getApp(), authService }
}

describe('ConnectController', () => {
  it('requires the existing authenticated session for device operations', async () => {
    const { app, authService } = createApp()
    const response = await app.request('/api/connect/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'web-device-12345678', name: 'Browser', platform: 'web' })
    })

    expect(response.status).toBe(401)
    expect(authService.getUserBySession).toHaveBeenCalledWith(undefined)
  })

  it('accepts bearer-token sessions for device operations', async () => {
    const { app, authService } = createApp(true)
    const response = await app.request('/api/connect/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-session'
      },
      body: JSON.stringify({ deviceId: 'mobile-device-12345678', name: 'Mobile', platform: 'android' })
    })

    expect(response.status).toBe(200)
    expect(authService.getUserBySession).toHaveBeenCalledWith('valid-session')
  })

  it('classifies presence from backend last-seen timestamps', () => {
    const now = Date.now()
    expect(getConnectDeviceStatus(new Date(now - 10_000), now)).toBe('online')
    expect(getConnectDeviceStatus(new Date(now - 5 * 60_000), now)).toBe('recently-active')
    expect(getConnectDeviceStatus(new Date(now - 2 * 86_400_000), now)).toBe('offline')
  })

  it('allows only the defined handoff state transitions', () => {
    expect(isAllowedHandoffTransition('accept', 'PENDING')).toBe(true)
    expect(isAllowedHandoffTransition('ready', 'ACCEPTED')).toBe(true)
    expect(isAllowedHandoffTransition('source-paused', 'TARGET_READY')).toBe(true)
    expect(isAllowedHandoffTransition('started', 'COMMITTED')).toBe(true)
    expect(isAllowedHandoffTransition('started', 'TARGET_READY')).toBe(false)
    expect(isAllowedHandoffTransition('accept', 'COMMITTED')).toBe(false)
  })
})