import { MongoClient, type Db } from 'mongodb'
import process from 'node:process'

let databasePromise: Promise<Db> | undefined
let clientPromise: Promise<MongoClient> | undefined

export const getMongoClient = (): Promise<MongoClient> => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured')
  }

  clientPromise ??= MongoClient.connect(process.env.MONGO_URI).catch((error) => {
    clientPromise = undefined
    throw error
  })
  return clientPromise
}

export const getDatabase = (): Promise<Db> => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured')
  }

  databasePromise ??= getMongoClient()
    .then(async (client) => {
      const database = client.db(process.env.MONGO_DB_NAME)
      await Promise.all([
        database.collection('users').createIndex({ email: 1 }, { unique: true }),
        database.collection('users').createIndex({ username: 1 }, { unique: true }),
        database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
        database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        database.collection('connect_devices').createIndex({ userId: 1, deviceId: 1 }, { unique: true }),
        database.collection('connect_sessions').createIndex({ userId: 1 }, { unique: true }),
        database.collection('connect_handoffs').createIndex({ userId: 1, expiresAt: 1 })
      ])
      return database
    })
    .catch((error) => {
      databasePromise = undefined
      throw error
    })

  return databasePromise
}
