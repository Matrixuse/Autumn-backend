import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeSongs,
  claimRecommendationEventKey,
  getActiveDislikedTrackIds,
  getUpcomingTrackCount,
  isRecommendationRequestCurrent,
  mergeRecommendationTracks,
  resolveQueueSelection,
  scoreRecommendationCandidate,
  shouldRefillRecommendations,
  diversifyRecommendationCandidates,
  buildUpNextQueue,
  shuffleRecommendationList,
  validateGeneratedQueue
} from './recommendationQueue.js'

const source = {
  id: 'seed',
  title: 'Autumn Road',
  artist: 'Northbound',
  language: 'english',
  genre: ['alternative rock'],
  audio: 'https://audio.example/seed.mp3'
}

const track = (id, overrides = {}) => ({
  id,
  title: `Track ${id}`,
  artist: 'Other Artist',
  language: 'english',
  genre: ['alternative rock'],
  audio: `https://audio.example/${id}.mp3`,
  ...overrides
})

test('content-compatible candidates outrank unrelated candidates', () => {
  const relevant = scoreRecommendationCandidate({ candidate: track('relevant', { artist: 'Northbound' }), sourceSong: source })
  const unrelated = scoreRecommendationCandidate({ candidate: track('unrelated', { language: 'unknown', genre: ['classical'], artist: 'Elsewhere' }), sourceSong: source })
  assert.ok(relevant > unrelated)
})

test('explicit likes materially raise a candidate score', () => {
  const candidate = track('liked', { artist: 'Elsewhere' })
  const baseline = scoreRecommendationCandidate({ candidate, sourceSong: source })
  const liked = scoreRecommendationCandidate({ candidate, sourceSong: source, likedSongs: [candidate] })
  assert.ok(liked > baseline + 0.05)
})

test('following an artist raises the score of their songs', () => {
  const candidate = track('followed-artist-song', { artist: 'Followed Artist' })
  const baseline = scoreRecommendationCandidate({ candidate, sourceSong: source })
  const followed = scoreRecommendationCandidate({
    candidate,
    sourceSong: source,
    followedArtists: [{ id: 'artist-1', name: 'Followed Artist' }]
  })
  assert.ok(followed > baseline)
})

test('missing metadata produces a finite score', () => {
  const score = scoreRecommendationCandidate({ candidate: { id: 'sparse', title: 'Sparse Song' }, sourceSong: { id: 'seed' } })
  assert.ok(Number.isFinite(score))
  assert.ok(score < 0.5)
})

test('recent tracks receive a penalty without being treated as permanent dislikes', () => {
  const candidate = track('recent')
  const baseline = scoreRecommendationCandidate({ candidate, sourceSong: source })
  const recent = scoreRecommendationCandidate({ candidate, sourceSong: source, recentIds: new Set(['recent']) })
  assert.ok(recent < baseline)
  assert.notEqual(recent, -Infinity)
})

test('repeated skips lower ranking and explicit rejection excludes the candidate', () => {
  const candidate = track('skipped')
  const baseline = scoreRecommendationCandidate({ candidate, sourceSong: source })
  const skipped = scoreRecommendationCandidate({
    candidate,
    sourceSong: source,
    skipEvents: [{ trackId: 'skipped' }, { trackId: 'skipped' }]
  })
  const disliked = scoreRecommendationCandidate({ candidate, sourceSong: source, notInterested: ['skipped'] })
  assert.ok(skipped < baseline)
  assert.equal(disliked, -Infinity)
})

test('explicit dislike restoration clears only the latest matching dislike', () => {
  const active = getActiveDislikedTrackIds([
    { type: 'track_disliked', trackId: 'song-a', occurredAt: '2026-01-01T00:00:00.000Z' },
    { type: 'track_disliked', trackId: 'song-b', occurredAt: '2026-01-02T00:00:00.000Z' },
    { type: 'track_undisliked', trackId: 'song-a', occurredAt: '2026-01-03T00:00:00.000Z' }
  ])
  assert.deepEqual(active, ['song-b'])
})

test('duplicate sources collapse while distinct versions remain separate', () => {
  const duplicate = track('copy', { title: 'Same Song', artist: 'Artist', album: 'Album', duration: 200 })
  const sameRecording = { ...duplicate, id: 'copy-from-search' }
  const remix = { ...duplicate, id: 'remix', title: 'Same Song (Remix)', duration: 215 }
  assert.deepEqual(dedupeSongs([duplicate, sameRecording, remix]).map((song) => song.id), ['copy', 'remix'])
})

test('queue merge fills to 40 upcoming and preserves manual order', () => {
  const current = track('current')
  const manual = { ...track('manual'), queueSource: 'manual' }
  const initialQueue = [current, manual]
  const candidates = Array.from({ length: 45 }, (_, index) => track(`recommendation-${index}`))
  const merged = mergeRecommendationTracks(initialQueue, 0, candidates, 40)

  assert.equal(getUpcomingTrackCount(merged, 0), 40)
  assert.deepEqual(merged.slice(0, 2), initialQueue)
  assert.equal(merged[2].queueSource, 'recommendation')
  assert.equal(new Set(merged.map((song) => song.id)).size, merged.length)
})

test('queue merge never trims a user queue already above the target', () => {
  const existing = [track('current'), ...Array.from({ length: 42 }, (_, index) => track(`manual-${index}`))]
  const merged = mergeRecommendationTracks(existing, 0, [track('new-recommendation')], 40)
  assert.deepEqual(merged, existing)
})

test('playing a song already in the active queue keeps its index and queue', () => {
  const activeQueue = [track('first'), track('second'), track('third')]
  const selection = resolveQueueSelection(activeQueue, activeQueue[1])

  assert.deepEqual(selection.queue, activeQueue)
  assert.equal(selection.currentIndex, 1)
  assert.equal(selection.shouldRegenerate, false)
})

test('a section song absent from the active queue starts a new single-track queue', () => {
  const selected = track('selected-from-section')
  const selection = resolveQueueSelection([track('existing')], selected)

  assert.deepEqual(selection.queue, [selected])
  assert.equal(selection.currentIndex, 0)
  assert.equal(selection.shouldRegenerate, true)
})

test('refill starts at the low-water threshold and is disabled with autoplay', () => {
  const current = track('current')
  const queue = [current, ...Array.from({ length: 39 }, (_, index) => track(`queued-${index}`))]
  assert.ok(shouldRefillRecommendations(queue, 0, { targetUpcomingCount: 40, refillThreshold: 39 }))
  assert.ok(!shouldRefillRecommendations(queue, 0, { targetUpcomingCount: 40, refillThreshold: 39, autoplayEnabled: false }))
})

test('stale recommendation responses are rejected', () => {
  assert.ok(isRecommendationRequestCurrent(7, 7, true))
  assert.ok(!isRecommendationRequestCurrent(7, 8, true))
  assert.ok(!isRecommendationRequestCurrent(7, 7, false))
})

test('playback events can be claimed only once per event key', () => {
  const seen = new Set()
  assert.ok(claimRecommendationEventKey(seen, 'session-1:track_started'))
  assert.ok(!claimRecommendationEventKey(seen, 'session-1:track_started'))
})

test('artist diversity avoids long runs when alternatives are available', () => {
  const ranked = [
    { ...track('a1', { artist: 'Artist A' }), score: 1 },
    { ...track('a2', { artist: 'Artist A' }), score: 0.99 },
    { ...track('a3', { artist: 'Artist A' }), score: 0.98 },
    { ...track('b1', { artist: 'Artist B' }), score: 0.8 }
  ]
  const selected = diversifyRecommendationCandidates(ranked, 4, { maxConsecutiveArtist: 2, maxPerArtist: 4 })
  assert.equal(selected[0].artist, 'Artist A')
  assert.equal(selected[2].artist, 'Artist B')
})

test('candidate builder returns 40 upcoming playable tracks when sources supply enough', async () => {
  const suggestions = Array.from({ length: 18 }, (_, index) => track(`suggestion-${index}`, { artist: `Artist ${index % 6}` }))
  const searchResults = Array.from({ length: 40 }, (_, index) => track(`search-${index}`, { artist: `Discovery ${index % 10}` }))
  const apiClient = {
    get: async (path) => path.includes('/suggestions')
      ? { data: { data: suggestions } }
      : { data: { data: { results: searchResults } } }
  }

  const queue = await buildUpNextQueue(source, apiClient, { targetUpcomingCount: 40 })
  assert.equal(queue.length, 41)
  assert.equal(queue[0].id, source.id)
  assert.equal(queue.slice(1).length, 40)
  assert.ok(queue.slice(1).every((song) => song.id && song.audio))
})

test('candidate builder keeps relevance ranking instead of shuffling recommendations', async () => {
  const unrelated = track('unrelated', { artist: 'Elsewhere' })
  const related = track('related', { artist: 'Northbound' })
  const apiClient = {
    get: async () => ({ data: { data: [unrelated, related] } })
  }

  const queue = await buildUpNextQueue(source, apiClient, { targetUpcomingCount: 2, refreshSeed: 'ranking-test' })
  assert.deepEqual(queue.slice(1).map((song) => song.id), ['related', 'unrelated'])
})

test('candidate builder returns only real playable history tracks when providers fail', async () => {
  const apiClient = { get: async () => { throw new Error('provider unavailable') } }
  const knownTrack = track('known-history')
  const queue = await buildUpNextQueue(source, apiClient, {
    targetUpcomingCount: 40,
    history: [knownTrack]
  })

  assert.deepEqual(queue.map((song) => song.id), ['seed', 'known-history'])
})

test('Up Next interleaves independent section, history, followed-artist, mood, and popular sources', async () => {
  const sourceTracks = (prefix) => Array.from({ length: 4 }, (_, index) => track(`${prefix}-${index}`, {
    artist: `${prefix} Artist ${index}`
  }))
  const apiClient = { get: async () => ({ data: { data: [] } }) }
  const queue = await buildUpNextQueue(source, apiClient, {
    targetUpcomingCount: 10,
    candidateSources: {
      quickPicks: sourceTracks('quick'),
      mostListened: sourceTracks('listened'),
      followedArtists: sourceTracks('followed'),
      moods: sourceTracks('mood'),
      popular: sourceTracks('popular')
    }
  })
  const sources = queue.slice(1).map((song) => song.recommendationSource)

  assert.equal(queue.length, 11)
  assert.deepEqual(new Set(sources), new Set(['quick picks', 'most listened', 'followed artists', 'mood discovery', 'most popular']))
  for (const sourceName of new Set(sources)) {
    assert.equal(sources.filter((name) => name === sourceName).length, 2)
  }
})

test('english seed yields a 50-song english-only queue when enough eligible tracks exist', async () => {
  const englishTracks = Array.from({ length: 60 }, (_, index) => ({
    ...track(`english-${index}`, { language: 'english', artist: `English Artist ${index % 8}` }),
    audio: `https://audio.example/english-${index}.mp3`
  }))
  const nonEnglishTracks = Array.from({ length: 12 }, (_, index) => ({
    ...track(`hindi-${index}`, { language: 'hindi', artist: `Hindi Artist ${index % 4}` }),
    audio: `https://audio.example/hindi-${index}.mp3`
  }))
  const apiClient = {
    get: async (path) => {
      if (path.includes('/suggestions')) return { data: { data: [...englishTracks, ...nonEnglishTracks] } }
      return { data: { data: { results: [] } } }
    }
  }

  const queue = await buildUpNextQueue({ ...source, id: 'seed-english', language: 'english' }, apiClient, {
    targetUpcomingCount: 50,
    refreshSeed: 'english-test'
  })

  assert.ok(queue.length >= 51)
  assert.ok(queue.slice(1).every((song) => String(song.language || song.lang || '').toLowerCase() === 'english'))
  assert.equal(new Set(queue.map((song) => song.id)).size, queue.length)
})

test('two-pass shuffle preserves identities and count while permuting order deterministically', () => {
  const base = Array.from({ length: 12 }, (_, index) => ({ id: `track-${index}`, title: `Song ${index}`, artist: `Artist ${index % 3}`, language: 'english', audio: `https://audio.example/${index}.mp3` }))
  const shuffled = shuffleRecommendationList(base, { rng: () => 0.75, seed: 'shuffle-1' })
  const final = shuffleRecommendationList(shuffled, { rng: () => 0.25, seed: 'shuffle-2' })

  assert.equal(final.length, base.length)
  assert.equal(new Set(final.map((song) => song.id)).size, base.length)
  assert.deepEqual(new Set(final.map((song) => song.id)), new Set(base.map((song) => song.id)))
  assert.ok(validateGeneratedQueue(final, { sourceSong: base[0], targetLength: 12 }).isValid)
})
