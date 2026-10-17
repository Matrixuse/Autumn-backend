import { App } from '../../../app.js'
import { AuthError } from '#modules/auth/services'
import { ConnectController, getConnectDeviceStatus, isAllowedHandoffTransition } from '#modules/connect/controllers'
import { describe, expect, it, vi } from 'vitest'

const createApp = (authenticated = false) => {
  const authService = {
    getUserBySession: vi.fn((token: string | undefined) => {
      if (!authenticated || token !== 'valid-session') return Promise.reject(new AuthError('Authentication required', 401))
      return Promise.resolve({ id: '507f1f77bcf86cd799439011', username: 'listener', email: 'listener@example.com', createdAt: new Date().toISOString() })
    })
  }
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