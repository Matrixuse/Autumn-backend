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

export const MAX_RECOMMENDATION_EVENTS_PER_USER = 1000

let recommendationIndexesPromise: Promise<void> | undefined

export class RecommendationService {
  private async getEventsCollection(): Promise<Collection<RecommendationEventDocument>> {
    const database = await getDatabase()
    const collection = database.collection<RecommendationEventDocument>('recommendation_events')
    recommendationIndexesPromise ??= Promise.all([
      collection.createIndex({ userId: 1, eventId: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, occurredAt: -1 })
    ]).then(() => undefined).catch((error) => {
      recommendationIndexesPromise = undefined
      throw error
    })
    await recommendationIndexesPromise
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
    const overflow = await collection.find({ userId: databaseUserId })
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
    const events = await collection.find({ userId: new ObjectId(userId) })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(MAX_RECOMMENDATION_EVENTS_PER_USER)
      .toArray()

    return {
      events: events.reverse().map(({ eventId, type, trackId, track, progressSeconds, durationSeconds, occurredAt }) => ({
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
}
