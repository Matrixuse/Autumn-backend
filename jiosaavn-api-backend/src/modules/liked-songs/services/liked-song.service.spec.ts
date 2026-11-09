import { ObjectId, type Db } from 'mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabase } from '#common/database'
import { LikedSongService } from '#modules/liked-songs/services'

vi.mock('#common/database', () => ({ getDatabase: vi.fn() }))

const userId = '507f1f77bcf86cd799439011'
const otherUserId = '507f191e810c19729de860ea'
const song = { id: 'song-1', title: 'Song One', artist: 'Artist One' }
const createCursor = (documents: unknown[]) => {
  const cursor = {
    sort: vi.fn(() => cursor),
    toArray: vi.fn(() => Promise.resolve(documents))
  }
  return cursor
}

const documents = [{ song }]
const cursor = createCursor(documents)
type TestFilter = { userId: ObjectId; songId?: string }
type TestOperation = { updateOne: { filter: TestFilter; update: Record<string, unknown>; upsert: boolean } }
let lastFindFilter: { userId: ObjectId } | undefined
let lastBulkOperations: TestOperation[] = []
let lastUpdateCall: { filter: TestFilter; update: Record<string, unknown>; options?: { upsert: boolean } } | undefined
let lastDeleteFilter: TestFilter | undefined
const collection = {
  createIndex: vi.fn(() => Promise.resolve('liked_songs_user_song_unique')),
  find: vi.fn((filter: { userId: ObjectId }) => {
    lastFindFilter = filter
    return cursor
  }),
  bulkWrite: vi.fn((operations: TestOperation[]) => {
    lastBulkOperations = operations
    return Promise.resolve({ upsertedCount: 1 })
  }),
  updateOne: vi.fn((filter: TestFilter, update: Record<string, unknown>, options?: { upsert: boolean }) => {
    lastUpdateCall = { filter, update, options }
    return Promise.resolve({ upsertedCount: 1, matchedCount: 0 })
  }),
  deleteOne: vi.fn((filter: TestFilter) => {
    lastDeleteFilter = filter
    return Promise.resolve({ deletedCount: 1 })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  lastFindFilter = undefined
  lastBulkOperations = []
  lastUpdateCall = undefined
  lastDeleteFilter = undefined
  vi.mocked(getDatabase).mockResolvedValue({ collection: vi.fn(() => collection) } as unknown as Db)
})

describe('LikedSongService', () => {
  it('loads liked songs scoped to the authenticated user', async () => {
    const result = await new LikedSongService().getLikedSongs(userId)
    expect(result).toEqual([song])
    expect(lastFindFilter).toEqual({ userId: new ObjectId(userId) })
    expect(cursor.sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 })
  })

  it('deduplicates import batches and upserts by user and song', async () => {
    const result = await new LikedSongService().syncLikedSongs(userId, [song, song])
    const operations = lastBulkOperations
    expect(result).toEqual([song])
    expect(operations).toHaveLength(1)
    expect(operations[0]?.updateOne.filter).toMatchObject({ userId: new ObjectId(userId), songId: 'song-1' })
    expect(operations[0]?.updateOne.upsert).toBe(true)
  })

  it('saves and deletes only within the given account', async () => {
    await new LikedSongService().saveLikedSong(userId, song)
    await new LikedSongService().removeLikedSong(otherUserId, 'song-1')
    expect(lastUpdateCall?.filter).toMatchObject({ userId: new ObjectId(userId), songId: 'song-1' })
    expect(lastDeleteFilter).toEqual({ userId: new ObjectId(otherUserId), songId: 'song-1' })
  })
})
