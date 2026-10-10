import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId, type Db } from 'mongodb'
import { MAX_RECOMMENDATION_EVENTS_PER_USER, RecommendationService } from '#modules/recommendations/services'
import { getDatabase } from '#common/database'

vi.mock('#common/database', () => ({ getDatabase: vi.fn() }))

const userId = '507f1f77bcf86cd799439011'
const duplicateEvent = {
  eventId: 'same-event',
  type: 'track_started' as const,
  trackId: 'song-1',
  occurredAt: new Date().toISOString()
}

const createCursor = (documents: unknown[]) => {
  const cursor = {
    sort: vi.fn(() => cursor),
    skip: vi.fn(() => cursor),
    project: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    toArray: vi.fn(() => Promise.resolve(documents))
  }
  return cursor
}

describe('RecommendationService', () => {
  const overflow = [{ _id: new ObjectId() }]
  let cursor = createCursor(overflow)
  const collection = {
    createIndex: vi.fn(() => Promise.resolve('index')),
    bulkWrite: vi.fn((operations: Array<{ updateOne: { filter: { userId: ObjectId; eventId: string } } }>) => Promise.resolve({ upsertedCount: operations.length })),
    find: vi.fn(() => cursor),
    deleteMany: vi.fn(() => Promise.resolve({ deletedCount: overflow.length }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    cursor = createCursor(overflow)
    vi.mocked(getDatabase).mockResolvedValue({
      collection: vi.fn(() => collection)
    } as unknown as Db)
  })

  it('deduplicates event IDs in a batch and trims old events past the per-user cap', async () => {
    const service = new RecommendationService()
    const result = await service.recordEvents(userId, [duplicateEvent, duplicateEvent])

    expect(result.acceptedCount).toBe(1)
    const operations = collection.bulkWrite.mock.calls[0][0]
    expect(operations).toHaveLength(1)
    expect(operations[0].updateOne.filter).toMatchObject({ userId: new ObjectId(userId), eventId: 'same-event' })
    expect(cursor.skip).toHaveBeenCalledWith(MAX_RECOMMENDATION_EVENTS_PER_USER)
    expect(collection.deleteMany).toHaveBeenCalledWith({ _id: { $in: overflow.map((event) => event._id) } })
  })

  it('returns a bounded chronological profile for the requested user', async () => {
    const profileEvents = [
      { eventId: 'event-2', type: 'track_completed', trackId: 'song-2', occurredAt: new Date('2026-01-02T00:00:00.000Z') },
      { eventId: 'event-1', type: 'track_started', trackId: 'song-1', occurredAt: new Date('2026-01-01T00:00:00.000Z') }
    ]
    collection.find.mockImplementation(() => createCursor(profileEvents))

    const result = await new RecommendationService().getProfile(userId)

    expect(collection.find).toHaveBeenCalledWith({ userId: new ObjectId(userId) })
    expect(result.events.map((event) => event.eventId)).toEqual(['event-1', 'event-2'])
  })
})
