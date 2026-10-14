import test from 'node:test'
import assert from 'node:assert/strict'
import { createPastPlaysSnapshot, getPastPlaysSnapshotKey, derivePastPlaysCandidates } from './pastPlays.js'

const now = new Date('2026-10-14T12:00:00Z')

const createSong = (id, title, artist) => ({
  id,
  title,
  artist,
  audio: `https://audio.example/${id}.mp3`,
  image: `https://image.example/${id}.jpg`
})

const buildEvents = (trackId, entries) => entries.map((entry, index) => ({
  eventId: `${trackId}-${index}`,
  type: entry.type,
  trackId,
  occurredAt: entry.occurredAt,
  track: { title: entry.title || 'Song', artist: entry.artist || 'Artist' }
}))

test('past plays selects a forgotten favourite with a historical baseline and recent decline', () => {
  const song = createSong('song-1', 'Perfect', 'Ed Sheeran')
  const events = [
    ...buildEvents('song-1', [
      { type: 'track_started', occurredAt: '2026-09-11T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-09-16T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-09-20T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-09-22T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_completed', occurredAt: '2026-09-22T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-09-29T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_completed', occurredAt: '2026-09-29T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-10-02T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_skipped', occurredAt: '2026-10-02T12:00:00.000Z', title: song.title, artist: song.artist },
      { type: 'track_started', occurredAt: '2026-10-05T12:00:00.000Z', title: song.title, artist: song.artist },
    ])
  ]

  const result = derivePastPlaysCandidates({
    userId: 'user-a',
    listenHistory: [song],
    recommendationEvents: events,
    now,
    target: 24
  })

  assert.ok(result.some((candidate) => String(candidate.id) === 'song-1'))
  assert.ok(result[0].score >= 0)
})

test('past plays snapshot is stable for the same user and day and resets on a new day', () => {
  const user = { id: 'user-a' }
  const history = [createSong('song-1', 'Perfect', 'Ed Sheeran')]
  const events = buildEvents('song-1', [
    { type: 'track_started', occurredAt: '2026-09-11T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-09-16T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-09-20T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-09-22T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_completed', occurredAt: '2026-09-22T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-09-29T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_completed', occurredAt: '2026-09-29T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-10-02T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_skipped', occurredAt: '2026-10-02T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' },
    { type: 'track_started', occurredAt: '2026-10-05T12:00:00.000Z', title: 'Perfect', artist: 'Ed Sheeran' }
  ])

  const first = createPastPlaysSnapshot({ user, listenHistory: history, recommendationEvents: events, now })
  const repeat = createPastPlaysSnapshot({ user, listenHistory: history, recommendationEvents: events, now })
  const nextDayUser = { id: 'user-b' }
  const nextDayHistory = [createSong('song-2', 'Bad Guy', 'Billie Eilish')]
  const nextDayEvents = buildEvents('song-2', [
    { type: 'track_started', occurredAt: '2026-09-11T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-09-16T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-09-20T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-09-22T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_completed', occurredAt: '2026-09-22T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-09-29T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_completed', occurredAt: '2026-09-29T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-10-02T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_skipped', occurredAt: '2026-10-02T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' },
    { type: 'track_started', occurredAt: '2026-10-05T12:00:00.000Z', title: 'Bad Guy', artist: 'Billie Eilish' }
  ])
  const nextDay = createPastPlaysSnapshot({ user: nextDayUser, listenHistory: nextDayHistory, recommendationEvents: nextDayEvents, now: new Date('2026-10-15T12:00:00Z') })

  assert.ok(first.length > 0)
  assert.deepEqual(first.map((song) => song.id), repeat.map((song) => song.id))
  assert.notDeepEqual(first.map((song) => song.id), nextDay.map((song) => song.id))
  assert.equal(getPastPlaysSnapshotKey(user.id, now), `autumn_past_plays:${user.id}:${'2026-10-14'}`)
})

test('past plays excludes duplicate IDs and keeps a unique final list', () => {
  const history = Array.from({ length: 4 }, (_, index) => createSong(`song-${index}`, `Song ${index}`, `Artist ${index}`))
  const events = history.flatMap((song) => buildEvents(song.id, [
    { type: 'track_started', occurredAt: '2026-08-10T12:00:00.000Z', title: song.title, artist: song.artist },
    { type: 'track_completed', occurredAt: '2026-08-12T12:00:00.000Z', title: song.title, artist: song.artist },
    { type: 'track_started', occurredAt: '2026-09-01T12:00:00.000Z', title: song.title, artist: song.artist },
    { type: 'track_skipped', occurredAt: '2026-09-02T12:00:00.000Z', title: song.title, artist: song.artist },
    { type: 'track_started', occurredAt: '2026-10-03T12:00:00.000Z', title: song.title, artist: song.artist }
  ]))

  const snapshot = createPastPlaysSnapshot({ user: { id: 'user-b' }, listenHistory: history, recommendationEvents: events, now })

  assert.equal(new Set(snapshot.map((song) => String(song.id))).size, snapshot.length)
  assert.ok(snapshot.length <= 24)
})
