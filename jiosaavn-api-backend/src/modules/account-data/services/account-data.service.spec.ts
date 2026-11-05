import { ObjectId, type Db } from 'mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabase } from '#common/database'
import { AccountDataService } from '#modules/account-data/services'

vi.mock('#common/database', () => ({ getDatabase: vi.fn() }))

const userId = '507f1f77bcf86cd799439011'
const remoteDocument = {
  _id: new ObjectId(),
  userId: new ObjectId(userId),
  listenHistory: [{ id: 'remote-song' }],
  userPlaylists: [{ id: 'remote-playlist' }],
  listenAgain: [{ id: 'remote-again' }],
  followedArtists: [{ id: 'remote-artist', name: 'Remote Artist' }],
  notInterested: ['remote-dislike'],
  preferences: { autoplay: false, gapless: true, dataSaving: false },
  searchHistory: ['remote query'],
  createdAt: new Date(),
  updatedAt: new Date()
}

let lastUpdate: { filter: unknown; update: Record<string, unknown> } | undefined
const collection = {
  createIndex: vi.fn(() => Promise.resolve('account_data_user_unique')),
  findOne: vi.fn(() => Promise.resolve(remoteDocument)),
  updateOne: vi.fn((filter: unknown, update: Record<string, unknown>) => {
    lastUpdate = { filter, update }
    return Promise.resolve({ upsertedCount: 0, matchedCount: 1 })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  lastUpdate = undefined
  vi.mocked(getDatabase).mockResolvedValue({ collection: vi.fn(() => collection) } as unknown as Db)
})

describe('AccountDataService', () => {
  it('merges local library data without dropping remote entries or preferences', async () => {
    await new AccountDataService().importLocalData(userId, {
      listenHistory: [{ id: 'local-song' }],
      userPlaylists: [{ id: 'local-playlist' }],
      listenAgain: [{ id: 'local-again' }],
      followedArtists: [{ id: 'local-artist', name: 'Local Artist' }],
      notInterested: ['local-dislike'],
      preferences: { autoplay: true, dataSaving: true },
      searchHistory: ['local query']
    })

    const set = lastUpdate?.update.$set as Record<string, unknown>
    expect(set.listenHistory).toEqual([{ id: 'remote-song' }, { id: 'local-song' }])
    expect(set.userPlaylists).toEqual([{ id: 'remote-playlist' }, { id: 'local-playlist' }])
    expect(set.listenAgain).toEqual([{ id: 'remote-again' }, { id: 'local-again' }])
    expect(set.followedArtists).toEqual([
      { id: 'remote-artist', name: 'Remote Artist' },
      { id: 'local-artist', name: 'Local Artist' }
    ])
    expect(set.notInterested).toEqual(['remote-dislike', 'local-dislike'])
    expect(set['preferences.autoplay']).toBe(false)
    expect(set['preferences.gapless']).toBe(true)
    expect(set['preferences.dataSaving']).toBe(false)
    expect(set.searchHistory).toEqual(['local query', 'remote query'])
  })

  it('uses local preferences when the account has no saved settings yet', async () => {
    collection.findOne.mockResolvedValueOnce(null as unknown as typeof remoteDocument)
    collection.findOne.mockResolvedValueOnce(null as unknown as typeof remoteDocument)
    await new AccountDataService().importLocalData(userId, {
      preferences: { autoplay: false, gapless: true, dataSaving: true }
    })
    const set = lastUpdate?.update.$set as Record<string, unknown>
    expect(set['preferences.autoplay']).toBe(false)
    expect(set['preferences.gapless']).toBe(true)
    expect(set['preferences.dataSaving']).toBe(true)
  })

  it('patches only the submitted account field', async () => {
    await new AccountDataService().patch(userId, { preferences: { autoplay: false } })
    expect(lastUpdate?.filter).toEqual({ userId: new ObjectId(userId) })
    expect(lastUpdate?.update.$set).toMatchObject({ 'preferences.autoplay': false })
    expect(Object.keys(lastUpdate?.update.$set as object)).toEqual(['preferences.autoplay', 'updatedAt'])
  })
})
