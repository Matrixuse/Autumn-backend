import { ObjectId, type Collection } from 'mongodb'
import { getDatabase } from '#common/database'
import type { RecommendationEvent } from '#modules/recommendations/models'

interface RecommendationEventDocument {
  _id: ObjectId
  userId: ObjectId
  eventId: string
  type: RecommendationEvent['type']
  trackId: string
  track?: RecommendationEvent['track']
  progressSeconds?: number
  durationSeconds?: number
  occurredAt: Date
}

interface PastPlaysSnapshotDocument {
  _id: ObjectId
  userId: ObjectId
  dateKey: string
  generatedAt: Date
  version: string
  songs: Array<Record<string, unknown>>
}

export const MAX_RECOMMENDATION_EVENTS_PER_USER = 1000
const PAST_PLAYS_TARGET = 24
const PAST_PLAYS_MIN_HISTORY = 5
const PAST_PLAYS_INACTIVE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

let recommendationIndexesPromise: Promise<void> | undefined
let pastPlaysIndexesPromise: Promise<void> | undefined

const normalizeTrackId = (value: unknown) => String(value ?? '').trim()
const normalizeArtist = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const getDateKey = (date = new Date()) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const getTrackIdentifier = (track: Record<string, unknown> | undefined, fallbackId?: string) =>
  normalizeTrackId(track?.id ?? track?.trackId ?? fallbackId)
const getTrackDescriptor = (track: Record<string, unknown> | undefined = {}, fallbackId = '') => ({
  id: getTrackIdentifier(track, fallbackId),
  title: String(track?.title ?? track?.name ?? 'Unknown track').slice(0, 200),
  artist: normalizeArtist(track?.artist ?? track?.subtitle ?? track?.primaryArtists ?? 'Unknown artist').slice(0, 200),
  image: typeof track?.image === 'string' ? track.image : typeof track?.imageUrl === 'string' ? track.imageUrl : '',
  audio: typeof track?.audio === 'string' ? track.audio : typeof track?.audioUrl === 'string' ? track.audioUrl : '',
  ...track
})
const shuffleOnce = <T>(items: T[]) => {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

const sortTracks = (tracks: Array<{ id: string; score: number; song: Record<string, unknown> }>) =>
  [...tracks].sort((first, second) => second.score - first.score || String(first.id).localeCompare(String(second.id)))

const derivePastPlaysCandidates = (events: RecommendationEvent[], history: Array<Record<string, unknown>>) => {
  const trackMap = new Map<
    string,
    {
      id: string
      song: Record<string, unknown>
      lastPlayedAt: Date | null
      eventCount: number
      completed: number
      recent7: number
      recent30: number
      skipped: number
      replays: number
      meaningfulProgress: number
    }
  >()

  history.forEach((song) => {
    const id = getTrackIdentifier(song as Record<string, unknown>, '')
    if (!id) return
    trackMap.set(id, {
      id,
      song: getTrackDescriptor(song as Record<string, unknown>, id),
      lastPlayedAt: null,
      eventCount: 0,
      completed: 0,
      recent7: 0,
      recent30: 0,
      skipped: 0,
      replays: 0,
      meaningfulProgress: 0
    })
  })

  events.forEach((event) => {
    const id = normalizeTrackId(event.trackId)
    if (!id) return
    const existing = trackMap.get(id) ?? {
      id,
      song: getTrackDescriptor(event.track as Record<string, unknown>, id),
      lastPlayedAt: null,
      eventCount: 0,
      completed: 0,
      recent7: 0,
      recent30: 0,
      skipped: 0,
      replays: 0,
      meaningfulProgress: 0
    }
    if (event.track)
      existing.song = { ...existing.song, ...getTrackDescriptor(event.track as Record<string, unknown>, id) }
    const occurredAt = new Date(event.occurredAt)
    if (!Number.isNaN(occurredAt.getTime())) {
      const deltaDays = (Date.now() - occurredAt.getTime()) / DAY_MS
      if (deltaDays <= 7) existing.recent7 += 1
      if (deltaDays <= 30) existing.recent30 += 1
      if (!existing.lastPlayedAt || occurredAt.getTime() > existing.lastPlayedAt.getTime())
        existing.lastPlayedAt = occurredAt
    }
    if (event.type === 'track_started' || event.type === 'meaningful_progress') existing.eventCount += 1
    if (event.type === 'track_completed') existing.completed += 1
    if (event.type === 'track_skipped') existing.skipped += 1
    if (event.type === 'track_replayed') existing.replays += 1
    if (event.type === 'meaningful_progress') existing.meaningfulProgress += 1
    trackMap.set(id, existing)
  })

  const candidates: Array<{ id: string; score: number; song: Record<string, unknown> }> = []
  for (const entry of trackMap.values()) {
    const historicalActivity = Math.max(entry.eventCount, entry.completed, entry.replays)
    if (historicalActivity < PAST_PLAYS_MIN_HISTORY) continue
    if (!entry.lastPlayedAt || (Date.now() - entry.lastPlayedAt.getTime()) / DAY_MS < PAST_PLAYS_INACTIVE_DAYS) continue
    if (entry.recent7 > Math.max(1, Math.round(historicalActivity * 0.4))) continue

    const completionRate = entry.eventCount > 0 ? entry.completed / entry.eventCount : 0
    const skipRate = entry.eventCount > 0 ? entry.skipped / entry.eventCount : 0
    const daysSinceLastPlay = entry.lastPlayedAt
      ? (Date.now() - entry.lastPlayedAt.getTime()) / DAY_MS
      : Number.POSITIVE_INFINITY
    const historicalAffinity = clamp(
      (historicalActivity / 12) * 35 + completionRate * 35 * 100 + entry.replays * 8 + entry.meaningfulProgress * 6,
      0,
      100
    )
    const dormancy = clamp((daysSinceLastPlay / 60) * 100 + (entry.recent30 === 0 ? 20 : 0), 0, 100)
    const currentDisinterest = clamp(
      (historicalActivity > 0 ? ((historicalActivity - entry.recent30) / historicalActivity) * 100 : 0) +
        skipRate * 40 +
        (completionRate < 0.5 ? 10 : 0) +
        (daysSinceLastPlay >= 30 ? 12 : 0),
      0,
      100
    )
    const score = 0.45 * historicalAffinity + 0.3 * dormancy + 0.25 * currentDisinterest

    candidates.push({
      id: entry.id,
      song: { ...entry.song },
      score: Number(score.toFixed(2))
    })
  }

  return sortTracks(candidates).slice(0, PAST_PLAYS_TARGET * 3)
}

export class RecommendationService {
  private async getEventsCollection(): Promise<Collection<RecommendationEventDocument>> {
    const database = await getDatabase()
    const collection = database.collection<RecommendationEventDocument>('recommendation_events')
    recommendationIndexesPromise ??= Promise.all([
      collection.createIndex({ userId: 1, eventId: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, occurredAt: -1 })
    ])
      .then(() => undefined)
      .catch((error) => {
        recommendationIndexesPromise = undefined
        throw error
      })
    await recommendationIndexesPromise
    return collection
  }

  private async getPastPlaysCollection(): Promise<Collection<PastPlaysSnapshotDocument>> {
    const database = await getDatabase()
    const collection = database.collection<PastPlaysSnapshotDocument>('past_plays_snapshots')
    pastPlaysIndexesPromise ??= Promise.all([
      collection.createIndex({ userId: 1, dateKey: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, generatedAt: -1 })
    ])
      .then(() => undefined)
      .catch((error) => {
        pastPlaysIndexesPromise = undefined
        throw error
      })
    await pastPlaysIndexesPromise
    return collection
  }

  async recordEvents(userId: string, events: RecommendationEvent[]) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    if (!events.length) return { acceptedCount: 0 }

    const databaseUserId = new ObjectId(userId)
    const collection = await this.getEventsCollection()
    const uniqueEvents = [...new Map(events.map((event) => [event.eventId, event])).values()]
    const operations = uniqueEvents.map((event) => ({
      updateOne: {
        filter: { userId: databaseUserId, eventId: event.eventId },
        update: {
          $setOnInsert: {
            userId: databaseUserId,
            eventId: event.eventId,
            type: event.type,
            trackId: event.trackId,
            track: event.track,
            progressSeconds: event.progressSeconds,
            durationSeconds: event.durationSeconds,
            occurredAt: new Date(event.occurredAt)
          }
        },
        upsert: true
      }
    }))

    const result = await collection.bulkWrite(operations, { ordered: false })
    const overflow = await collection
      .find({ userId: databaseUserId })
      .sort({ occurredAt: -1, _id: -1 })
      .skip(MAX_RECOMMENDATION_EVENTS_PER_USER)
      .project({ _id: 1 })
      .toArray()

    if (overflow.length) {
      await collection.deleteMany({ _id: { $in: overflow.map((event) => event._id) } })
    }

    return { acceptedCount: result.upsertedCount }
  }

  async getProfile(userId: string) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const collection = await this.getEventsCollection()
    const events = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(MAX_RECOMMENDATION_EVENTS_PER_USER)
      .toArray()

    return {
      events: events
        .reverse()
        .map(({ eventId, type, trackId, track, progressSeconds, durationSeconds, occurredAt }) => ({
          eventId,
          type,
          trackId,
          track,
          progressSeconds,
          durationSeconds,
          occurredAt: occurredAt.toISOString()
        }))
    }
  }

  async getPastPlaysSnapshot(
    userId: string,
    events: RecommendationEvent[],
    history: Array<Record<string, unknown>> = []
  ) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')

    const dateKey = getDateKey()
    const snapshotCollection = await this.getPastPlaysCollection()
    const existing = await snapshotCollection.findOne({ userId: new ObjectId(userId), dateKey })
    if (existing) {
      return {
        dateKey: existing.dateKey,
        generatedAt: existing.generatedAt.toISOString(),
        version: existing.version,
        songs: existing.songs
      }
    }

    const candidates = derivePastPlaysCandidates(events, history)
    const selected = shuffleOnce(candidates).slice(0, PAST_PLAYS_TARGET)
    const snapshot = {
      userId: new ObjectId(userId),
      dateKey,
      generatedAt: new Date(),
      version: 'past-plays-v1',
      songs: selected.map((candidate) => candidate.song)
    }

    await snapshotCollection.updateOne(
      { userId: new ObjectId(userId), dateKey },
      { $setOnInsert: snapshot },
      { upsert: true }
    )

    return {
      dateKey,
      generatedAt: snapshot.generatedAt.toISOString(),
      version: snapshot.version,
      songs: snapshot.songs
    }
  }
}
