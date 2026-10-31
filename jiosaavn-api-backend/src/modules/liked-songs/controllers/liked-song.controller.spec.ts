import { App } from '../../../app.js'
import { AuthError } from '#modules/auth/services'
import { LikedSongController } from '#modules/liked-songs/controllers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const user = {
  id: '507f1f77bcf86cd799439011',
  username: 'listener',
  email: 'listener@example.com',
  createdAt: new Date().toISOString()
}
const song = { id: 'song-1', title: 'Song One', artist: 'Artist One' }

const createTestApp = (authenticated = true) => {
  const authService = {
    getUserBySession: vi.fn((token: string | undefined) => {
      if (!authenticated || token !== 'valid-session')
        return Promise.reject(new AuthError('Authentication required', 401))
      return Promise.resolve(user)
    })
  }
  const likedSongService = {
    getLikedSongs: vi.fn(() => Promise.resolve([song])),
    syncLikedSongs: vi.fn((_userId: string, songs: Record<string, unknown>[]) => Promise.resolve(songs)),
    saveLikedSong: vi.fn((_userId: string, savedSong: Record<string, unknown>) =>
      Promise.resolve({ ...savedSong, id: String(savedSong.id) })
    ),
    removeLikedSong: vi.fn((_userId: string, songId: string) => Promise.resolve({ songId }))
  }
  const controller = new LikedSongController(authService, likedSongService)
  return { app: new App([controller]).getApp(), authService, likedSongService }
}

const jsonHeaders = { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' }

describe('LikedSongController', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let likedSongService: ReturnType<typeof createTestApp>['likedSongService']

  beforeEach(() => {
    const testApp = createTestApp()
    app = testApp.app
    likedSongService = testApp.likedSongService
  })

  it('returns songs for the authenticated account', async () => {
    const response = await app.request('/api/liked-songs', { headers: jsonHeaders })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, data: { songs: [song] } })
    expect(likedSongService.getLikedSongs).toHaveBeenCalledWith(user.id)
  })

  it('merges a validated local library under the authenticated account', async () => {
    const response = await app.request('/api/liked-songs/sync', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ songs: [song] })
    })
    expect(response.status).toBe(200)
    expect(likedSongService.syncLikedSongs).toHaveBeenCalledWith(user.id, [song])
  })

  it('saves and removes songs under the authenticated account', async () => {
    const saved = await app.request('/api/liked-songs/song-1', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ song })
    })
    const removed = await app.request('/api/liked-songs/song-1', { method: 'DELETE', headers: jsonHeaders })
    expect(saved.status).toBe(200)
    expect(removed.status).toBe(200)
    expect(likedSongService.saveLikedSong).toHaveBeenCalledWith(user.id, song)
    expect(likedSongService.removeLikedSong).toHaveBeenCalledWith(user.id, 'song-1')
  })

  it('rejects invalid and unauthenticated writes', async () => {
    const invalid = await app.request('/api/liked-songs/sync', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ songs: [{ title: 'Missing ID' }] })
    })
    const unauthenticated = createTestApp(false)
    const unauthorized = await unauthenticated.app.request('/api/liked-songs', { method: 'GET' })
    expect(invalid.status).toBe(400)
    expect(unauthorized.status).toBe(401)
    expect(unauthenticated.likedSongService.getLikedSongs).not.toHaveBeenCalled()
  })

  it('rejects a song ID that does not match its route', async () => {
    const response = await app.request('/api/liked-songs/song-2', {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ song })
    })
    expect(response.status).toBe(400)
    expect(likedSongService.saveLikedSong).not.toHaveBeenCalled()
  })
})
