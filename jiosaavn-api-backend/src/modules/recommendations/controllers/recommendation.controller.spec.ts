import { App } from '../../../app.js'
import { AuthError } from '#modules/auth/services'
import { RecommendationController } from '#modules/recommendations/controllers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const user = {
  id: '507f1f77bcf86cd799439011',
  username: 'listener',
  email: 'listener@example.com',
  createdAt: new Date().toISOString()
}
const event = {
  eventId: 'playback-1-start',
  type: 'track_started',
  trackId: 'song-1',
  track: { title: 'Song One', artist: 'Artist One', language: 'english' },
  occurredAt: new Date().toISOString()
}

const createTestApp = (authenticated = true) => {
  const authService = {
    getUserBySession: vi.fn((token: string | undefined) => {
      if (!authenticated || token !== 'valid-session')
        return Promise.reject(new AuthError('Authentication required', 401))
      return Promise.resolve(user)
    })
  }
  const recommendationService = {
    getProfile: vi.fn(() => Promise.resolve({ events: [] })),
    recordEvents: vi.fn((_userId: string, events: unknown[]) => Promise.resolve({ acceptedCount: events.length })),
    getPastPlaysSnapshot: vi.fn(() =>
      Promise.resolve({
        dateKey: '2026-10-14',
        generatedAt: new Date().toISOString(),
        version: 'past-plays-v1',
        songs: [{ id: 'song-1', title: 'Perfect', artist: 'Ed Sheeran', audio: 'https://audio.example/song-1.mp3' }]
      })
    )
  }
  const controller = new RecommendationController(authService, recommendationService)
  return { app: new App([controller]).getApp(), authService, recommendationService }
}

describe('RecommendationController', () => {
  let app: ReturnType<typeof createTestApp>['app']
  let authService: ReturnType<typeof createTestApp>['authService']
  let recommendationService: ReturnType<typeof createTestApp>['recommendationService']

  beforeEach(() => {
    const testApp = createTestApp()
    app = testApp.app
    authService = testApp.authService
    recommendationService = testApp.recommendationService
  })

  it('loads an authenticated user profile only for the session owner', async () => {
    const response = await app.request('/api/recommendations/profile', {
      headers: { Cookie: 'jiosaavn_session=valid-session' }
    })

    expect(response.status).toBe(200)
    expect(authService.getUserBySession).toHaveBeenCalledWith('valid-session')
    expect(recommendationService.getProfile).toHaveBeenCalledWith(user.id)
  })

  it('validates event batches before recording them', async () => {
    const response = await app.request('/api/recommendations/events', {
      method: 'POST',
      headers: { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ ...event, type: 'arbitrary_event' }] })
    })

    expect(response.status).toBe(400)
    expect(recommendationService.recordEvents).not.toHaveBeenCalled()
  })

  it('records valid events under the authenticated user ID', async () => {
    const response = await app.request('/api/recommendations/events', {
      method: 'POST',
      headers: { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] })
    })

    expect(response.status).toBe(200)
    expect(recommendationService.recordEvents).toHaveBeenCalledWith(user.id, [event])
  })

  it('rejects unauthenticated event writes', async () => {
    const unauthenticated = createTestApp(false)
    const response = await unauthenticated.app.request('/api/recommendations/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] })
    })

    expect(response.status).toBe(401)
    expect(unauthenticated.recommendationService.recordEvents).not.toHaveBeenCalled()
  })

  it('returns the authenticated user past plays snapshot', async () => {
    const response = await app.request('/api/recommendations/past-plays', {
      method: 'POST',
      headers: { Cookie: 'jiosaavn_session=valid-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [{ id: 'song-1', title: 'Perfect', artist: 'Ed Sheeran', audio: 'https://audio.example/song-1.mp3' }],
        events: [event]
      })
    })

    expect(response.status).toBe(200)
    expect(recommendationService.getPastPlaysSnapshot).toHaveBeenCalledWith(
      user.id,
      [event],
      [{ id: 'song-1', title: 'Perfect', artist: 'Ed Sheeran', audio: 'https://audio.example/song-1.mp3' }]
    )
  })
})
