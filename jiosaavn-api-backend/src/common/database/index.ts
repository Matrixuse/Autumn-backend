import { MongoClient, type Db } from 'mongodb'
import process from 'node:process'

let databasePromise: Promise<Db> | undefined

export const getDatabase = (): Promise<Db> => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured')
  }

  databasePromise ??= MongoClient.connect(process.env.MONGO_URI)
    .then(async (client) => {
      const database = client.db(process.env.MONGO_DB_NAME)
      await Promise.all([
        database.collection('users').createIndex({ email: 1 }, { unique: true }),
        database.collection('users').createIndex({ username: 1 }, { unique: true }),
        database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
        database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      ])
      return database
    })
    .catch((error) => {
      databasePromise = undefined
      throw error
    })

  return databasePromise
}
