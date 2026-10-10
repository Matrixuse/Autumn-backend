import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectAndSelectQuickPicks,
  deduplicatePlayableQuickPicks,
  fisherYatesShuffle,
  normalizeQuickPickSong
} from './quickPicksEngine.js'

const songs = (prefix, count) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  title: `${prefix} song ${index}`,
  artist: `${prefix} artist`,
  audio: `https://audio.example/${prefix}-${index}.mp3`
}))

const identitySet = (items) => new Set(items.map((song) => song.id))

test('all fulfilled personalized source collections contribute before selection', async () => {
  const moods = songs('mood', 4)
  const history = songs('history', 4)
  const liked = songs('liked', 4)
  const sources = songs('source', 12)
  let globalCalls = 0
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [moods, history, liked],
    sourceLoaders: [async () => sources],
    fetchGlobalCandidates: async () => { globalCalls += 1; return [] },
    random: () => 0
  })

  assert.equal(result.length, 24)
  assert.equal(globalCalls, 0)
  assert.deepEqual(identitySet(result), new Set([...moods, ...history, ...liked, ...sources].map((song) => song.id)))
})

test('a failed personalized source does not discard successful collections', async () => {
  const history = songs('history', 12)
  const result = await collectAndSelectQuickPicks({
    sourceLoaders: [async () => history, async () => { throw new Error('source unavailable') }],
    fetchGlobalCandidates: async ({ missingCount }) => songs('global', missingCount),
    random: () => 0
  })

  assert.equal(result.length, 24)
  assert.ok(history.every((song) => result.some((item) => item.id === song.id)))
})

test('24 or more personalized candidates do not request global candidates', async () => {
  let calls = 0
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [songs('personalized', 32)],
    fetchGlobalCandidates: async () => { calls += 1; return songs('global', 24) },
    random: () => 0
  })

  assert.equal(calls, 0)
  assert.equal(result.length, 24)
  assert.ok(result.every((song) => song.id.startsWith('personalized-')))
})

test('17 personalized candidates plus seven unique global candidates produce 24', async () => {
  const personalized = songs('personal', 17)
  const requests = []
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [personalized],
    fetchGlobalCandidates: async ({ missingCount, excludeKeys, batchIndex }) => {
      requests.push({ missingCount, excludeKeys, batchIndex })
      return songs('global', missingCount)
    },
    random: () => 0
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].missingCount, 7)
  assert.equal(requests[0].batchIndex, 0)
  assert.equal(result.length, 24)
  assert.equal(new Set(result.map((song) => song.id)).size, 24)
})

test('20 and 23 personalized candidates request only four and one fallback tracks', async (context) => {
  for (const [personalizedCount, expectedMissing] of [[20, 4], [23, 1]]) {
    await context.test(`${personalizedCount} personalized`, async () => {
      let requested = 0
      const result = await collectAndSelectQuickPicks({
        personalizedSources: [songs(`personal-${personalizedCount}`, personalizedCount)],
        fetchGlobalCandidates: async ({ missingCount }) => {
          requested = missingCount
          return songs(`global-${personalizedCount}`, missingCount)
        },
        random: () => 0
      })
      assert.equal(requested, expectedMissing)
      assert.equal(result.length, 24)
    })
  }
})

test('global candidates matching personalized songs or each other count once, then more batches are requested', async () => {
  const personalized = songs('personal', 23)
  let batchCount = 0
  const duplicatePersonal = { ...personalized[0], providerId: 'alternate-provider-id' }
  const duplicateHistoryTrack = { ...personalized[1], providerId: 'alternate-history-id' }
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [personalized],
    fetchGlobalCandidates: async () => {
      batchCount += 1
      if (batchCount === 1) return [duplicatePersonal, duplicateHistoryTrack]
      return [songs('extra', 1)[0]]
    },
    random: () => 0
  })

  assert.equal(batchCount, 2)
  assert.equal(result.length, 24)
  assert.equal(new Set(result.map((song) => song.id)).size, 24)
})

test('the complete final collection is shuffled exactly twice before selecting 24', async () => {
  const personalized = songs('personal', 17)
  const shuffleLengths = []
  let randomCalls = 0
  const random = () => { randomCalls += 1; return 0 }
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [personalized],
    fetchGlobalCandidates: async ({ missingCount }) => songs('global', missingCount),
    random,
    shuffle: (items, rng) => {
      shuffleLengths.push(items.length)
      return fisherYatesShuffle(items, rng)
    }
  })

  assert.deepEqual(shuffleLengths, [24, 24])
  assert.equal(randomCalls, 46)
  assert.equal(result.length, 24)
})

test('song identity distinguishes different artists and versions and requires real playback URLs', () => {
  const first = songs('first', 1)[0]
  const sameTitleDifferentArtist = { ...first, id: 'other', artist: 'Different Artist' }
  const remix = { ...first, id: 'remix', title: `${first.title} (Remix)` }
  const unique = deduplicatePlayableQuickPicks([first, { ...first, providerId: 'alternate-id' }, sameTitleDifferentArtist, remix, { id: 'no-audio', title: 'No audio', artist: 'Artist' }])

  assert.equal(unique.length, 3)
  assert.equal(normalizeQuickPickSong({ title: 'No id', artist: 'Artist', audio: 'https://audio.example/no-id.mp3' }).id, undefined)
})

test('exhausted catalog returns only the available unique playable songs', async () => {
  const personalized = songs('personal', 3)
  const result = await collectAndSelectQuickPicks({
    personalizedSources: [personalized],
    fetchGlobalCandidates: async () => [],
    maxGlobalBatches: 3,
    random: () => 0
  })

  assert.deepEqual(identitySet(result), identitySet(personalized))
})
