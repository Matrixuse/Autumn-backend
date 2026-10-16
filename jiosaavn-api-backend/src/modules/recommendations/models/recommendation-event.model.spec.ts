import { describe, expect, it } from 'vitest'
import { RecommendationEventsBatchModel } from '#modules/recommendations/models'

describe('RecommendationEventsBatchModel', () => {
  it('accepts supported playback events and rejects unknown event types', () => {
    const event = {
      eventId: 'event-1',
      type: 'track_started',
      trackId: 'song-1',
      occurredAt: new Date().toISOString()
    }
    expect(RecommendationEventsBatchModel.safeParse({ events: [event] }).success).toBe(true)
    expect(RecommendationEventsBatchModel.safeParse({ events: [{ ...event, type: 'not_supported' }] }).success).toBe(
      false
    )
  })

  it('caps the number of accepted events per request', () => {
    const events = Array.from({ length: 51 }, (_, index) => ({
      eventId: `event-${index}`,
      type: 'track_started',
      trackId: `song-${index}`,
      occurredAt: new Date().toISOString()
    }))
    expect(RecommendationEventsBatchModel.safeParse({ events }).success).toBe(false)
  })
})
