import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeSongs,
  claimRecommendationEventKey,
  getActiveDislikedTrackIds,
  getUpcomingTrackCount,
  isRecommendationRequestCurrent,
  isPlayRequestCurrent,
  buildIndependentQueueSeed,
  mergeRecommendationTracks,
  RECOMMENDATION_WEIGHTS,
  resolveRecommendationLanguage,
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

test('recommendation weights are configurable and include the requested signals', () => {
  assert.deepEqual(RECOMMENDATION_WEIGHTS, {
    genre: 0.2,
    mood: 0.15,
    artist: 0.15,
    userPreference: 0.2,
    history: 0.1,
    audioCharacteristics: 0.1,
    album: 0.1
  })

  const sourceWithFeatures = track('source-features', {
    mood: ['chill'],
    audioFeatures: { energy: 0.2, danceability: 0.3, tempo: 90 }
  })
  const closeMatch = track('close-match', {
    mood: ['chill'],
    audioFeatures: { energy: 0.25, danceability: 0.35, tempo: 95 }
  })
  const mismatch = track('mismatch', {
    mood: ['party'],
    audioFeatures: { energy: 0.9, danceability: 0.85, tempo: 180 }
  })
  const weights = { genre: 0, mood: 0.5, artist: 0, userPreference: 0, history: 0, audioCharacteristics: 0.5, album: 0 }
  const closeScore = scoreRecommendationCandidate({ candidate: closeMatch, sourceSong: sourceWithFeatures, scoringWeights: weights })
  const mismatchScore = scoreRecommendationCandidate({ candidate: mismatch, sourceSong: sourceWithFeatures, scoringWeights: weights })
  assert.ok(closeScore > mismatchScore)
})

test('unknown seed language resolves only from explicit preference or a confident history majority', () => {
  const unknownSeed = track('unknown-seed', { language: 'unknown', title: 'Mystery' })
  const hindiHistory = Array.from({ length: 3 }, (_, index) => track(`hindi-history-${index}`, { language: 'hindi' }))

  assert.equal(resolveRecommendationLanguage(unknownSeed, { history: [...hindiHistory, track('english-history')] }), 'hindi')
  assert.equal(resolveRecommendationLanguage(unknownSeed, { history: [hindiHistory[0], track('english-history')] }), 'unknown')
  assert.equal(resolveRecommendationLanguage(unknownSeed, { userPreferences: { preferredLanguage: 'hi' } }), 'hindi')
})

test('multilingual candidates are accepted only when the preference is explicitly enabled', async () => {
  const englishTracks = Array.from({ length: 10 }, (_, index) => track(`opt-in-english-${index}`, { language: 'english' }))
  const apiClient = {
    get: async (path) => path.includes('/suggestions')
      ? { data: { data: englishTracks } }
      : { data: { data: { results: [] } } }
  }
  const queue = await buildUpNextQueue(track('opt-in-hindi-seed', { language: 'hindi' }), apiClient, {
    targetUpcomingCount: 6,
    userPreferences: { multilingualRecommendations: true },
    refreshSeed: 'multilingual-opt-in'
  })

  assert.equal(queue.length, 7)
  assert.ok(queue.slice(1).every((song) => song.language === 'english'))
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

test('selecting from a collection seeds an independent queue and preserves only upcoming manual tracks', () => {
  const collection = [track('quick-pick-before'), track('selected-song'), track('quick-pick-after')]
  const existingQueue = [
    { ...track('already-played-manual'), queueSource: 'manual' },
    track('current-recommendation'),
    { ...track('manual-first'), queueSource: 'manual' },
    { ...track('queued-recommendation'), queueSource: 'recommendation' },
    { ...track('manual-second'), queueSource: 'manual' }
  ]

  const seeded = buildIndependentQueueSeed(collection[1], existingQueue, 1)

  assert.deepEqual(seeded.map((song) => song.id), ['selected-song', 'manual-first', 'manual-second'])
  assert.deepEqual(seeded.map((song) => song.queueSource), ['seed', 'manual', 'manual'])
})

test('user collections are scored as candidates rather than copied as a queue', async () => {
  const playlistSongs = [track('playlist-a'), track('playlist-b'), track('playlist-a')]
  const queue = await buildUpNextQueue(source, null, {
    targetUpcomingCount: 10,
    collections: [
      { id: 'playlist', mood: 'chill', songs: playlistSongs },
      [track('listen-again-song')]
    ]
  })

  assert.deepEqual(new Set(queue.slice(1).map((song) => song.id)), new Set(['playlist-a', 'playlist-b', 'listen-again-song']))
  assert.notDeepEqual(queue.slice(1).map((song) => song.id), playlistSongs.map((song) => song.id))
  assert.ok(queue.slice(1).every((song) => song.recommendationSource === 'user collections'))
  assert.ok(queue.slice(1).filter((song) => song.id.startsWith('playlist-')).every((song) => song.mood === 'chill'))
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
  assert.ok(isPlayRequestCurrent(7, 7))
  assert.ok(!isPlayRequestCurrent(7, 8))
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
    { ...track('b1', { artist: 'Artist B' }), score: 0.8 },
    { ...track('c1', { artist: 'Artist C' }), score: 0.7 },
    { ...track('d1', { artist: 'Artist D' }), score: 0.6 }
  ]
  const selected = diversifyRecommendationCandidates(ranked, 6, { maxConsecutiveArtist: 2, maxPerArtist: 4 })
  assert.equal(selected[0].artist, 'Artist A')
  assert.equal(new Set(selected.slice(0, 4).map((song) => song.artist)).size, 4)
})

test('artist cooldown relaxes when the available catalog is too small', () => {
  const ranked = [
    { ...track('limited-a1', { artist: 'Artist A' }), score: 1 },
    { ...track('limited-a2', { artist: 'Artist A' }), score: 0.9 },
    { ...track('limited-b1', { artist: 'Artist B' }), score: 0.8 }
  ]
  const selected = diversifyRecommendationCandidates(ranked, 3, { refreshSeed: 'small-artist-catalog' })
  assert.equal(selected.length, 3)
  assert.equal(new Set(selected.map((song) => song.id)).size, 3)
})

test('weighted selection varies close scores without promoting distant low scores', () => {
  const ranked = [
    { ...track('close-a', { artist: 'Artist A' }), score: 0.9 },
    { ...track('close-b', { artist: 'Artist B' }), score: 0.9 },
    { ...track('distant-low', { artist: 'Artist C', genre: ['classical'] }), score: 0.2 }
  ]
  const first = diversifyRecommendationCandidates(ranked, 1, { refreshSeed: 'weighted-a', rng: () => 0 })
  const second = diversifyRecommendationCandidates(ranked, 1, { refreshSeed: 'weighted-b', rng: () => 0.99 })

  assert.equal(first[0].id, 'close-a')
  assert.equal(second[0].id, 'close-b')
  assert.notEqual(first[0].id, 'distant-low')
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

test('candidate builder returns only real playable history tracks when providers fail', async () => {
  const apiClient = { get: async () => { throw new Error('provider unavailable') } }
  const knownTrack = track('known-history')
  const queue = await buildUpNextQueue(source, apiClient, {
    targetUpcomingCount: 40,
    history: [knownTrack]
  })

  assert.deepEqual(queue.map((song) => song.id), ['seed', 'known-history'])
})

test('up next interleaves Quick Picks, listening, followed-artist, mood, and popular sources', async () => {
  const makeSource = (prefix) => Array.from({ length: 4 }, (_, index) => track(`${prefix}-${index}`, {
    artist: `${prefix} Artist ${index}`
  }))
  const queue = await buildUpNextQueue(source, null, {
    targetUpcomingCount: 10,
    candidateSources: {
      quickPicks: makeSource('quick'),
      mostListened: makeSource('listened'),
      followedArtists: makeSource('followed'),
      moods: makeSource('mood'),
      popular: makeSource('popular')
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
  const unknownLanguageTracks = Array.from({ length: 5 }, (_, index) => track(`unknown-${index}`, { language: 'unknown' }))
  const apiClient = {
    get: async (path) => {
      if (path.includes('/suggestions')) return { data: { data: [...englishTracks, ...nonEnglishTracks, ...unknownLanguageTracks] } }
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

test('English-only selection overrides the multilingual recommendations preference', async () => {
  const candidates = [
    track('english-candidate', { language: 'english' }),
    track('hindi-candidate', { language: 'hindi' })
  ]
  const apiClient = {
    get: async () => ({ data: { data: candidates } })
  }
  const queue = await buildUpNextQueue(source, apiClient, {
    targetUpcomingCount: 10,
    userPreferences: { multilingualRecommendations: true }
  })

  assert.ok(queue.slice(1).length > 0)
  assert.ok(queue.slice(1).every((song) => song.language === 'english'))
  assert.ok(!queue.some((song) => song.id === 'hindi-candidate'))
})

test('Hollywood seed without language metadata still gets English-only recommendations', async () => {
  const hollywoodSeed = track('hollywood-seed', {
    title: 'Bad Guy',
    artist: 'Billie Eilish',
    language: 'unknown'
  })
  const candidates = [
    track('hollywood-candidate', { title: 'Shape of You', artist: 'Ed Sheeran', language: 'unknown' }),
    track('hindi-candidate', { language: 'hindi' })
  ]
  const apiClient = { get: async () => ({ data: { data: candidates } }) }
  const queue = await buildUpNextQueue(hollywoodSeed, apiClient, {
    targetUpcomingCount: 10,
    userPreferences: { multilingualRecommendations: true }
  })

  assert.deepEqual(queue.slice(1).map((song) => song.id), ['hollywood-candidate'])
})

test('Hindi seed excludes English and unknown-language candidates at the final filter', async () => {
  const hindiTracks = Array.from({ length: 12 }, (_, index) => track(`hindi-only-${index}`, { language: 'hindi' }))
  const otherTracks = [track('english-leak', { language: 'english' }), track('unknown-leak', { language: 'unknown' })]
  const apiClient = {
    get: async (path) => path.includes('/suggestions')
      ? { data: { data: [...hindiTracks, ...otherTracks] } }
      : { data: { data: { results: [] } } }
  }
  const hindiSeed = track('hindi-seed', { language: 'hi' })
  const queue = await buildUpNextQueue(hindiSeed, apiClient, { targetUpcomingCount: 8, refreshSeed: 'hindi-test' })

  assert.ok(queue.slice(1).length > 0)
  assert.ok(queue.slice(1).every((song) => song.language === 'hindi'))
  assert.ok(!queue.some((song) => ['english-leak', 'unknown-leak'].includes(song.id)))
})

test('unknown seed with no confident language does not call mixed-language discovery', async () => {
  let requestCount = 0
  const apiClient = { get: async () => { requestCount += 1; return { data: { data: [] } } } }
  const unknownSeed = track('unknown-seed', { language: 'unknown', title: 'Mystery' })
  const queue = await buildUpNextQueue(unknownSeed, apiClient, { targetUpcomingCount: 50 })

  assert.deepEqual(queue.map((song) => song.id), ['unknown-seed'])
  assert.equal(requestCount, 0)
})

test('small eligible catalogs return unique available tracks without padding', async () => {
  const first = track('small-a')
  const second = track('small-b')
  const third = track('small-c')
  const apiClient = {
    get: async (path) => path.includes('/suggestions')
      ? { data: { data: [first, second, first] } }
      : { data: { data: { results: [second, third, third] } } }
  }
  const queue = await buildUpNextQueue(source, apiClient, {
    targetUpcomingCount: 50,
    history: [third],
    refreshSeed: 'small-catalog'
  })

  assert.deepEqual(new Set(queue.map((song) => song.id)), new Set(['seed', 'small-a', 'small-b', 'small-c']))
  assert.equal(queue.length, 4)
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
