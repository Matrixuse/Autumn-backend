import { App } from '../../../app.js'
import { AuthController } from '#modules/auth/controllers'
import { AuthError, AuthService } from '#modules/auth/services'
import { afterEach, describe, expect, it, vi } from 'vitest'

const user = {
  id: '507f1f77bcf86cd799439011',
  username: 'listener',
  email: 'listener@example.com',
  createdAt: new Date().toISOString()
}

const createApp = () => new App([new AuthController()]).getApp()

afterEach(() => vi.restoreAllMocks())

describe('AuthController profile updates', () => {
  it('updates username and email for the authenticated account', async () => {
    const getUser = vi.spyOn(AuthService.prototype, 'getUserBySession').mockResolvedValue(user)
    const updateProfile = vi.spyOn(AuthService.prototype, 'updateProfile').mockResolvedValue(user)
    const app = createApp()
    const response = await app.request('/api/auth/profile', {
      method: 'PATCH',
      headers: { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'new_listener', email: 'new@example.com' })
    })
    expect(response.status).toBe(200)
    expect(getUser).toHaveBeenCalledWith('valid-session')
    expect(updateProfile).toHaveBeenCalledWith(user.id, 'new_listener', 'new@example.com')
  })

  it('rejects invalid profile data and unauthenticated updates', async () => {
    vi.spyOn(AuthService.prototype, 'getUserBySession').mockResolvedValue(user)
    const updateProfile = vi.spyOn(AuthService.prototype, 'updateProfile').mockResolvedValue(user)
    const app = createApp()
    const invalid = await app.request('/api/auth/profile', {
      method: 'PATCH',
      headers: { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', email: 'not-an-email' })
    })
    const unauthenticated = createApp()
    vi.spyOn(AuthService.prototype, 'getUserBySession').mockRejectedValue(new AuthError('Authentication required', 401))
    const unauthorized = await unauthenticated.request('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'new_listener', email: 'new@example.com' })
    })
    expect(invalid.status).toBe(400)
    expect(unauthorized.status).toBe(401)
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
