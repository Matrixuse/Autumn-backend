import { ObjectId, type Collection } from 'mongodb'
import { getDatabase } from '#common/database'
import { getLikedSongId, type LikedSong } from '#modules/liked-songs/models'

interface LikedSongDocument {
  _id: ObjectId
  userId: ObjectId
  songId: string
  song: LikedSong
  createdAt: Date
  updatedAt: Date
}

let indexesPromise: Promise<void> | undefined

export class LikedSongService {
  private async getCollection(): Promise<Collection<LikedSongDocument>> {
    const collection = (await getDatabase()).collection<LikedSongDocument>('liked_songs')
    indexesPromise ??= collection
      .createIndex({ userId: 1, songId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((error) => {
        indexesPromise = undefined
        throw error
      })
    await indexesPromise
    return collection
  }

  async getLikedSongs(userId: string) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const collection = await this.getCollection()
    const documents = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()
    return documents.map(({ song }) => song)
  }

  async syncLikedSongs(userId: string, songs: LikedSong[]) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const uniqueSongs = [...new Map(songs.map((song) => [getLikedSongId(song), song])).values()]
    const collection = await this.getCollection()
    if (uniqueSongs.length) {
      const now = new Date()
      await collection.bulkWrite(
        uniqueSongs.map((song) => {
          const songId = getLikedSongId(song)
          return {
            updateOne: {
              filter: { userId: new ObjectId(userId), songId },
              update: {
                $set: { song: { ...song, id: songId }, updatedAt: now },
                $setOnInsert: { userId: new ObjectId(userId), songId, createdAt: now }
              },
              upsert: true
            }
          }
        }),
        { ordered: false }
      )
    }
    return this.getLikedSongs(userId)
  }

  async saveLikedSong(userId: string, song: LikedSong) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const collection = await this.getCollection()
    const songId = getLikedSongId(song)
    const now = new Date()
    await collection.updateOne(
      { userId: new ObjectId(userId), songId },
      {
        $set: { song: { ...song, id: songId }, updatedAt: now },
        $setOnInsert: { userId: new ObjectId(userId), songId, createdAt: now }
      },
      { upsert: true }
    )
    return { ...song, id: songId }
  }

  async removeLikedSong(userId: string, songId: string) {
    if (!ObjectId.isValid(userId)) throw new Error('Invalid user ID')
    const collection = await this.getCollection()
    await collection.deleteOne({ userId: new ObjectId(userId), songId })
    return { songId }
  }
}
