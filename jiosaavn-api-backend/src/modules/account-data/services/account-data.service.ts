import { ObjectId, type Collection } from 'mongodb'
import { getDatabase } from '#common/database'
import { emptyAccountData, type AccountDataPatch, type AccountRecord } from '#modules/account-data/models'

interface AccountDataDocument extends AccountDataPatch {
  _id: ObjectId
  userId: ObjectId
  createdAt: Date
  updatedAt: Date
}

const mergeRecords = (remote: AccountRecord[], local: AccountRecord[], limit: number) => {
  const records = new Map<string, AccountRecord>()
  for (const record of [...remote, ...local]) {
    const id = String(record.id ?? record._id)
    if (!records.has(id)) records.set(id, record)
  }
  return [...records.values()].slice(0, limit)
}

const mergeSearchHistory = (remote: string[], local: string[]) =>
  [...new Set([...local, ...remote].map((query) => query.trim()).filter(Boolean))].slice(0, 100)

let indexesPromise: Promise<void> | undefined

export class AccountDataService {
  private async getCollection(): Promise<Collection<AccountDataDocument>> {
    const collection = (await getDatabase()).collection<AccountDataDocument>('account_data')
    indexesPromise ??= collection
      .createIndex({ userId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((error) => {
        indexesPromise = undefined
        throw error
      })
    await indexesPromise
    return collection
  }

  async get(userId: string) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const document = await (await this.getCollection()).findOne({ userId: new ObjectId(userId) })
    const defaults = emptyAccountData()
    return {
      listenHistory: document?.listenHistory ?? defaults.listenHistory,
      userPlaylists: document?.userPlaylists ?? defaults.userPlaylists,
      listenAgain: document?.listenAgain ?? defaults.listenAgain,
      notInterested: document?.notInterested ?? defaults.notInterested,
      preferences: { ...defaults.preferences, ...document?.preferences },
      searchHistory: document?.searchHistory ?? defaults.searchHistory,
      feedback: document?.feedback ?? defaults.feedback
    }
  }

  async patch(userId: string, changes: AccountDataPatch) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const collection = await this.getCollection()
    const now = new Date()
    const setChanges: Record<string, unknown> = { ...changes }
    if (changes.preferences) {
      delete setChanges.preferences
      for (const [key, value] of Object.entries(changes.preferences)) setChanges[`preferences.${key}`] = value
    }
    await collection.updateOne(
      { userId: new ObjectId(userId) },
      {
        $set: { ...setChanges, updatedAt: now },
        $setOnInsert: { userId: new ObjectId(userId), createdAt: now }
      },
      { upsert: true }
    )
    return this.get(userId)
  }

  async importLocalData(userId: string, local: AccountDataPatch) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const storedDocument = await (await this.getCollection()).findOne({ userId: new ObjectId(userId) })
    const remote = await this.get(userId)
    const merged: AccountDataPatch = {}
    if (local.listenHistory) merged.listenHistory = mergeRecords(remote.listenHistory, local.listenHistory, 500)
    if (local.userPlaylists) merged.userPlaylists = mergeRecords(remote.userPlaylists, local.userPlaylists, 300)
    if (local.listenAgain) merged.listenAgain = mergeRecords(remote.listenAgain, local.listenAgain, 500)
    if (local.notInterested)
      merged.notInterested = [...new Set([...remote.notInterested, ...local.notInterested])].slice(0, 5000)
    if (local.preferences) merged.preferences = { ...local.preferences, ...(storedDocument?.preferences || {}) }
    if (local.searchHistory) merged.searchHistory = mergeSearchHistory(remote.searchHistory, local.searchHistory)
    if (local.feedback) merged.feedback = mergeRecords(remote.feedback, local.feedback, 100)
    return this.patch(userId, merged)
  }
}
