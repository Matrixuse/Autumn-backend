import test from 'node:test'
import assert from 'node:assert/strict'
import { createDailyRandom, getDailyRotationKey, getRotationBucketKey, SIX_HOUR_ROTATION_MS, shuffleForDailyRotation } from './dailyRotation.js'

const createSongs = (prefix, count) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  title: `${prefix} song ${index}`,
  artist: `${prefix} artist`,
  audio: `https://audio.example/${prefix}-${index}.mp3`
}))

const date = new Date(2026, 9, 10, 12)

test('daily shuffling is stable for a user and scope, and changes by day/account', () => {
  const songs = createSongs('song', 40)
  const first = shuffleForDailyRotation(songs, { userId: 'user-a', scope: 'moods', date })
  const repeat = shuffleForDailyRotation(songs, { userId: 'user-a', scope: 'moods', date })
  const nextDay = shuffleForDailyRotation(songs, { userId: 'user-a', scope: 'moods', date: new Date(2026, 9, 11, 12) })
  const anotherUser = shuffleForDailyRotation(songs, { userId: 'user-b', scope: 'moods', date })

  assert.deepEqual(first, repeat)
  assert.notDeepEqual(first, nextDay)
  assert.notDeepEqual(first, anotherUser)
  assert.notEqual(getDailyRotationKey('user-a', 'mix', date), getDailyRotationKey('user-b', 'mix', date))
})

test('daily random streams are deterministic for the same seed', () => {
  const first = createDailyRandom('quick-picks:user-a:2026-10-10')
  const repeated = createDailyRandom('quick-picks:user-a:2026-10-10')
  assert.deepEqual(Array.from({ length: 5 }, first), Array.from({ length: 5 }, repeated))
})

test('Quick picks rotation key stays fixed within six hours and advances at the boundary', () => {
  const start = new Date(2026, 9, 10, 0).getTime()
  const beforeBoundary = start + SIX_HOUR_ROTATION_MS - 1
  const nextBucket = start + SIX_HOUR_ROTATION_MS

  assert.equal(getRotationBucketKey('user-a', 'quick-picks', start), getRotationBucketKey('user-a', 'quick-picks', beforeBoundary))
  assert.notEqual(getRotationBucketKey('user-a', 'quick-picks', beforeBoundary), getRotationBucketKey('user-a', 'quick-picks', nextBucket))
  assert.notEqual(getRotationBucketKey('user-a', 'quick-picks', start), getRotationBucketKey('user-b', 'quick-picks', start))
})
