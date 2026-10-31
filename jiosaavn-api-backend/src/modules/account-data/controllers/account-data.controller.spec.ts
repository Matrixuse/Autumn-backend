import { App } from '../../../app.js'
import { AuthError } from '#modules/auth/services'
import { AccountDataController } from '#modules/account-data/controllers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const user = {
  id: '507f1f77bcf86cd799439011',
  username: 'listener',
  email: 'listener@example.com',
  createdAt: new Date().toISOString()
}
const data = {
  listenHistory: [{ id: 'song-1', title: 'Song One' }],
  userPlaylists: [],
  listenAgain: [],
  notInterested: [],
  preferences: { autoplay: true, gapless: false, dataSaving: false },
  searchHistory: [],
  feedback: []
}

const createTestApp = (authenticated = true) => {
  const authService = {
    getUserBySession: vi.fn((token: string | undefined) => {
      if (!authenticated || token !== 'valid-session')
        return Promise.reject(new AuthError('Authentication required', 401))
      return Promise.resolve(user)
    })
  }
  const accountDataService = {
    get: vi.fn(() => Promise.resolve(data)),
    patch: vi.fn((_userId: string, changes: Record<string, unknown>) => Promise.resolve({ ...data, ...changes })),
    importLocalData: vi.fn((_userId: string, changes: Record<string, unknown>) =>
      Promise.resolve({ ...data, ...changes })
    )
  }
  return {
    app: new App([new AccountDataController(authService, accountDataService)]).getApp(),
    authService,
    accountDataService
  }
}

const requestHeaders = { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' }

describe('AccountDataController', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let accountDataService: ReturnType<typeof createTestApp>['accountDataService']

  beforeEach(() => {
    const testApp = createTestApp()
    app = testApp.app
    accountDataService = testApp.accountDataService
  })

  it('returns account data only for the authenticated account', async () => {
    const response = await app.request('/api/account/data', { headers: requestHeaders })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, data })
    expect(accountDataService.get).toHaveBeenCalledWith(user.id)
  })

  it('patches only the submitted data fields', async () => {
    const changes = { preferences: { autoplay: false } }
    const response = await app.request('/api/account/data', {
      method: 'PATCH',
      headers: requestHeaders,
      body: JSON.stringify(changes)
    })
    expect(response.status).toBe(200)
    expect(accountDataService.patch).toHaveBeenCalledWith(user.id, changes)
  })

  it('merges imported local data under the authenticated account', async () => {
    const imported = { listenHistory: [{ id: 'song-2', title: 'Song Two' }] }
    const response = await app.request('/api/account/data/import', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(imported)
    })
    expect(response.status).toBe(200)
    expect(accountDataService.importLocalData).toHaveBeenCalledWith(user.id, imported)
  })

  it('rejects invalid and unauthenticated account data', async () => {
    const invalid = await app.request('/api/account/data', {
      method: 'PATCH',
      headers: requestHeaders,
      body: JSON.stringify({ unrecognized: true })
    })
    const unauthenticated = createTestApp(false)
    const unauthorized = await unauthenticated.app.request('/api/account/data')
    expect(invalid.status).toBe(400)
    expect(unauthorized.status).toBe(401)
    expect(unauthenticated.accountDataService.get).not.toHaveBeenCalled()
  })
})
