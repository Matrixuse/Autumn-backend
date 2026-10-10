import { getBestAudioUrl, getBestImageUrl } from './mediaQuality.js'
import { fetchRecommendationCandidates } from '../api/recommendations.js'

const normalizeText = (value = '') => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const normalizeTitle = (name = '') => String(name)
  .toLowerCase()
  .replace(/\s*[([].*?[)\]]/g, ' ')
  .replace(/\s*[-–—]\s*(?:(?:feat(?:uring)?|ft)\.?\s+.*|.*\b(?:remix|acoustic|slowed|sped\s*up|nightcore|instrumental|live|reverb|radio|edit|clean|session|demo|unplugged)\b.*)$/i, ' ')
  .replace(/[^a-z0-9]/g, '')
  .trim()

export const getPrimaryArtistName = (song = {}) => {
  const primaryArtist = song.artists?.primary?.[0]
  const allArtist = song.artists?.all?.[0]
  return primaryArtist?.name || primaryArtist?.title || allArtist?.name || allArtist?.title
    || song.primaryArtists || song.artist || song.subtitle || ''
}

export const getArtistKey = (song = {}) => {
  const primaryArtist = song.artists?.primary?.[0]
  const artistName = normalizeText(getPrimaryArtistName(song))
  return primaryArtist?.id ? `id:${primaryArtist.id}` : artistName ? `name:${artistName}` : `song:${song.id || song._id || 'unknown'}`
}

export const getSongLanguage = (song = {}) => String(song.language || song.lang || song.more_info?.language || '')
  .trim()
  .toLowerCase()

const getSongVersionToken = (song = {}) => {
  const title = String(song.title || song.name || '')
  const lowered = title.toLowerCase()
  const match = lowered.match(/\b(?:remix|acoustic|live|radio|instrumental|edit|clean|slowed|sped\s*up|nightcore|session|demo|unplugged|reverb)\b[^\n]*/i)
  return match ? match[0].trim() : ''
}

export const normalizeRecommendationSong = (song = {}) => ({
  ...song,
  id: song.id || song._id || song.musicId || song.trackId,
  title: song.title || song.name || 'Unknown Track',
  artist: getPrimaryArtistName(song) || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
  audio: getBestAudioUrl(song.audio || song.downloadUrl) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  language: getSongLanguage(song) || 'unknown',
  version: getSongVersionToken(song)
})

const getCandidateKey = (song = {}) => {
  const candidate = normalizeRecommendationSong(song)
  const explicitKey = [candidate.id, candidate._id, candidate.musicId, candidate.trackId, candidate.providerId, candidate?.more_info?.id]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).trim())[0]

  if (explicitKey) return `id:${explicitKey}`

  const artist = normalizeText(candidate.artist)
  const title = normalizeText(candidate.title)
  const album = normalizeText(candidate.album || candidate.more_info?.album || '')
  const duration = Number(candidate.duration) || 0
  return `meta:${artist}|${title}|${album}|${duration}|${candidate.language || 'unknown'}`
}

export const getSongIdentity = (song = {}) => {
  const candidate = normalizeRecommendationSong(song)
  const explicitKey = [candidate.id, candidate._id, candidate.musicId, candidate.trackId, candidate.providerId, candidate?.more_info?.id]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  if (explicitKey) return `id:${String(explicitKey).trim()}`
  return getCandidateKey(candidate)
}

export const dedupeSongs = (songs = []) => {
  const unique = []
  const seen = new Set()

  for (const song of Array.isArray(songs) ? songs : []) {
    if (!song) continue
    const candidate = normalizeRecommendationSong(song)
    const identity = getSongIdentity(candidate)
    const metadataKey = getCandidateKey({ ...candidate, id: null, _id: null, musicId: null, trackId: null, providerId: null })
    if (!identity || seen.has(identity) || seen.has(metadataKey)) continue
    seen.add(identity)
    seen.add(metadataKey)
    unique.push(candidate)
  }

  return unique
}

const getPopularityScore = (song = {}) => {
  const rawPopularity = song.popularity ?? song.playCount ?? song.play_count ?? song.listenCount ?? song.listens
  if (rawPopularity === undefined || rawPopularity === null || rawPopularity === '') return null
  const popularity = Number(rawPopularity)
  if (!Number.isFinite(popularity) || popularity < 0) return null
  return Math.min(1, popularity / 1000)
}

const getArtistNames = (song = {}) => {
  const artists = [
    ...(Array.isArray(song.artists?.primary) ? song.artists.primary : []),
    ...(Array.isArray(song.artists?.all) ? song.artists.all : [])
  ].map((artist) => artist?.name || artist?.title).filter(Boolean)
  const fallback = getPrimaryArtistName(song)
  return [...new Set((artists.length ? artists : [fallback])
    .map(normalizeText)
    .filter((artist) => artist && artist !== 'unknown' && artist !== 'unknown artist'))]
}

const getGenres = (song = {}) => {
  const genres = Array.isArray(song.genre) ? song.genre : [song.genre, ...(Array.isArray(song.genres) ? song.genres : [])]
  return new Set(genres.map(normalizeText).filter(Boolean))
}

const sameTrack = (first, second) => {
  const firstId = String(first?.id || first?._id || '')
  const secondId = String(second?.id || second?._id || '')
  return firstId && secondId && firstId === secondId
}

const getNotInterestedIds = (items = []) => new Set((Array.isArray(items) ? items : [])
  .map((item) => String(typeof item === 'object' ? item?.id || item?._id || '' : item || ''))
  .filter(Boolean))

const averageSignals = (signals) => {
  const available = signals.filter(({ value }) => Number.isFinite(value))
  if (!available.length) return null
  const totalWeight = available.reduce((total, signal) => total + signal.weight, 0)
  return available.reduce((total, signal) => total + signal.value * signal.weight, 0) / totalWeight
}

const getSimilarityScore = (candidate, source) => {
  const candidateArtists = getArtistNames(candidate)
  const sourceArtists = getArtistNames(source)
  const artistMatch = candidateArtists.some((artist) => sourceArtists.includes(artist))
  const sourceAlbum = normalizeText(typeof source.album === 'object' ? source.album?.name : source.album || source.more_info?.album)
  const candidateAlbum = normalizeText(typeof candidate.album === 'object' ? candidate.album?.name : candidate.album || candidate.more_info?.album)
  const sourceGenres = getGenres(source)
  const candidateGenres = getGenres(candidate)
  const genreIntersection = [...candidateGenres].filter((genre) => sourceGenres.has(genre)).length
  const genreUnion = new Set([...candidateGenres, ...sourceGenres]).size
  const relatedArtistIds = new Set((source.relatedArtists || []).map((artist) => String(artist?.id || '')).filter(Boolean))
  const candidateArtistIds = [
    ...(Array.isArray(candidate.artists?.primary) ? candidate.artists.primary : []),
    ...(Array.isArray(candidate.artists?.all) ? candidate.artists.all : [])
  ].map((artist) => String(artist?.id || '')).filter(Boolean)
  const relatedArtist = candidateArtistIds.some((artistId) => relatedArtistIds.has(artistId))
  const signals = [
    { value: sourceArtists.length && candidateArtists.length ? (artistMatch ? 0.9 : relatedArtist ? 0.72 : 0.12) : null, weight: 1 },
    { value: sourceAlbum && candidateAlbum ? (sourceAlbum === candidateAlbum ? 0.85 : 0.18) : null, weight: 0.8 },
    { value: getSongLanguage(source) !== 'unknown' && getSongLanguage(candidate) !== 'unknown'
      ? (getSongLanguage(source) === getSongLanguage(candidate) ? 0.68 : 0.12) : null, weight: 0.7 },
    { value: genreUnion ? genreIntersection / genreUnion : null, weight: 1.2 },
    { value: candidate.recommendationSource === 'suggestions' ? 0.92 : null, weight: 1.3 }
  ]
  return averageSignals(signals)
}

const getPreferenceScore = (candidate, likedSongs = [], history = []) => {
  const candidateArtists = getArtistNames(candidate)
  const exactLike = likedSongs.some((song) => sameTrack(song, candidate))
  if (exactLike) return 1

  const likedArtist = likedSongs.some((song) => getArtistNames(song).some((artist) => candidateArtists.includes(artist)))
  const historyArtistCount = history.reduce((count, item) => count + Number(
    getArtistNames(item).some((artist) => candidateArtists.includes(artist))
  ), 0)
  const historyTitleCount = history.reduce((count, item) => count + Number(
    normalizeTitle(item?.title || item?.name) === normalizeTitle(candidate.title)
  ), 0)
  if (!likedSongs.length && !history.length) return null
  return Math.min(1, (likedArtist ? 0.58 : 0) + Math.min(0.42, historyArtistCount * 0.14 + historyTitleCount * 0.24))
}

const getCompatibilityScore = (candidate, source) => {
  const sourceLanguage = getSongLanguage(source)
  const candidateLanguage = getSongLanguage(candidate)
  const sourceGenres = getGenres(source)
  const candidateGenres = getGenres(candidate)
  const sharedGenres = [...candidateGenres].filter((genre) => sourceGenres.has(genre)).length
  const genreUnion = new Set([...candidateGenres, ...sourceGenres]).size
  return averageSignals([
    { value: sourceLanguage !== 'unknown' && candidateLanguage !== 'unknown' ? (sourceLanguage === candidateLanguage ? 0.9 : 0.18) : null, weight: 0.8 },
    { value: genreUnion ? sharedGenres / genreUnion : null, weight: 1.2 }
  ])
}

const getAffinityScore = (candidate, history = []) => {
  if (history.length < 4) return null
  const artists = getArtistNames(candidate)
  if (!artists.length) return null
  const artistCount = history.reduce((count, item) => count + Number(getArtistNames(item).some((artist) => artists.includes(artist))), 0)
  const sameTrackCount = history.reduce((count, item) => count + Number(sameTrack(item, candidate)), 0)
  return Math.min(1, sameTrackCount * 0.25 + artistCount / Math.max(4, history.length))
}

const getDiscoveryScore = (candidate, history = [], compatibilityScore = null) => {
  if (compatibilityScore === null) return 0.25
  if (compatibilityScore < 0.35) return 0.1
  const artist = getArtistNames(candidate)[0]
  const candidateTitle = normalizeTitle(candidate.title)
  const familiar = history.some((item) => getArtistNames(item).includes(artist)
    || normalizeTitle(item?.title || item?.name) === candidateTitle)
  return familiar ? 0.25 : 0.85
}

const getSkipPenalty = (candidate, skipEvents = []) => {
  const skippedCount = skipEvents.reduce((count, event) => count + Number(
    String(event?.trackId || event?.songId || event?.track?.id || '') === String(candidate.id || '')
  ), 0)
  return Math.min(0.3, skippedCount * 0.08)
}

export const scoreRecommendationCandidate = ({ candidate, sourceSong, history = [], likedSongs = [], notInterested = [], recentIds = new Set(), skipEvents = [] }) => {
  const source = normalizeRecommendationSong(sourceSong || {})
  const song = normalizeRecommendationSong(candidate || {})
  if (!song.title || song.title === 'Unknown Track') return -Infinity
  const recentIdSet = recentIds instanceof Set ? recentIds : new Set(Array.isArray(recentIds) ? recentIds.map((value) => String(value)) : [])
  const songId = String(song.id || '')
  const sourceId = String(source.id || '')
  if (songId && sourceId && songId === sourceId) return -Infinity
  if (getNotInterestedIds(notInterested).has(songId)) return -Infinity

  const similarity = getSimilarityScore(song, source)
  const compatibility = getCompatibilityScore(song, source)
  const components = [
    { value: similarity, weight: 0.30 },
    { value: getPreferenceScore(song, likedSongs, history), weight: 0.25 },
    { value: compatibility, weight: 0.15 },
    { value: getAffinityScore(song, history), weight: 0.10 },
    { value: getPopularityScore(song), weight: 0.10 },
    { value: getDiscoveryScore(song, history, compatibility), weight: 0.10 }
  ]
  const normalizedScore = averageSignals(components) ?? 0.2
  const recentPenalty = songId && recentIdSet.has(songId) ? 0.18 : 0
  const skipPenalty = getSkipPenalty(song, skipEvents)
  const sourceVersion = getSongVersionToken(source)
  const candidateVersion = getSongVersionToken(song)
  const versionPenalty = sourceVersion && candidateVersion && sourceVersion !== candidateVersion ? 0.04 : 0

  return Math.max(0, Math.min(1, normalizedScore - recentPenalty - skipPenalty - versionPenalty))
}

export const getUpcomingTrackCount = (queue = [], currentIndex = -1) => {
  const tracks = Array.isArray(queue) ? queue : []
  const playingIndex = Number.isInteger(currentIndex) ? currentIndex : -1
  return Math.max(0, tracks.length - playingIndex - 1)
}

export const getActiveDislikedTrackIds = (events = []) => {
  const activeDislikes = new Set()
  const orderedEvents = [...(Array.isArray(events) ? events : [])]
    .sort((first, second) => String(first?.occurredAt || '').localeCompare(String(second?.occurredAt || '')))
  for (const event of orderedEvents) {
    const trackId = String(event?.trackId || '')
    if (!trackId) continue
    if (event.type === 'track_disliked') activeDislikes.add(trackId)
    if (event.type === 'track_undisliked') activeDislikes.delete(trackId)
  }
  return [...activeDislikes]
}

export const shouldRefillRecommendations = (queue, currentIndex, {
  targetUpcomingCount = 40,
  refillThreshold = targetUpcomingCount - 1,
  autoplayEnabled = true
} = {}) => {
  const upcomingCount = getUpcomingTrackCount(queue, currentIndex)
  return autoplayEnabled && upcomingCount < targetUpcomingCount && upcomingCount <= refillThreshold
}

export const isRecommendationRequestCurrent = (requestId, activeRequestId, autoplayEnabled = true) => (
  autoplayEnabled && requestId === activeRequestId
)

export const claimRecommendationEventKey = (seenKeys, key) => {
  if (!key) return true
  if (seenKeys.has(key)) return false
  seenKeys.add(key)
  return true
}

export const mergeRecommendationTracks = (queue = [], currentIndex = -1, candidates = [], targetUpcomingCount = 40) => {
  const nextQueue = Array.isArray(queue) ? [...queue] : []
  const target = Math.max(0, Number(targetUpcomingCount) || 0)
  let slots = Math.max(0, target - getUpcomingTrackCount(nextQueue, currentIndex))
  if (!slots) return nextQueue

  const seen = new Set(nextQueue.map(getSongIdentity))
  for (const candidate of dedupeSongs(candidates)) {
    if (slots <= 0) break
    const song = normalizeRecommendationSong(candidate)
    const identity = getSongIdentity(song)
    if (!song.id || !song.audio || !identity || seen.has(identity)) continue
    nextQueue.push({ ...song, queueSource: 'recommendation' })
    seen.add(identity)
    slots -= 1
  }
  return nextQueue
}

const getSearchSongs = async (apiClient, query, limit = 50) => {
  if (!query) return []
  try {
    const response = await apiClient.get('/search/songs', { params: { query, page: 0, limit } })
    const data = response.data?.data
    if (Array.isArray(data)) return data
    const results = data?.results || response.data?.results || []
    return Array.isArray(results) ? results : []
  } catch {
    return []
  }
}

export const resolveQueueSelection = (queue, track) => {
  const currentQueue = Array.isArray(queue) ? queue : []
  const existingIndex = track?.id
    ? currentQueue.findIndex((queuedTrack) => String(queuedTrack.id) === String(track.id))
    : -1

  if (existingIndex >= 0) {
    return {
      queue: currentQueue,
      currentIndex: existingIndex,
      track: currentQueue[existingIndex],
      shouldRegenerate: false
    }
  }

  return { queue: [track], currentIndex: 0, track, shouldRegenerate: true }
}

const stableHash = (value) => [...String(value)].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0)

export const diversifyRecommendationCandidates = (rankedCandidates = [], limit = 40, {
  maxConsecutiveArtist = 2,
  maxPerArtist = 4,
  refreshSeed = ''
} = {}) => {
  const remaining = Array.isArray(rankedCandidates) ? [...rankedCandidates] : []
  const selected = []
  const artistCounts = new Map()
  const genreCounts = new Map()
  let lastArtist = ''
  let consecutiveArtistCount = 0
  const target = Math.max(0, Number(limit) || 0)

  while (remaining.length && selected.length < target) {
    const eligible = remaining.filter((candidate) => {
      const artist = getArtistKey(candidate)
      return (artist !== lastArtist || consecutiveArtistCount < maxConsecutiveArtist)
        && (artistCounts.get(artist) || 0) < maxPerArtist
    })
    const pool = eligible.length ? eligible : remaining
    const selectedCandidate = pool.reduce((best, candidate) => {
      const artist = getArtistKey(candidate)
      const genre = [...getGenres(candidate)][0] || ''
      const artistBonus = (artistCounts.get(artist) || 0) === 0 ? 0.035 : 0
      const genreBonus = genre && !genreCounts.has(genre) ? 0.02 : 0
      const sequencePenalty = artist && artist === lastArtist ? 0.06 : 0
      const adjusted = Number(candidate.score || 0) + artistBonus + genreBonus - sequencePenalty
      const bestAdjusted = best ? Number(best.score || 0) + ((artistCounts.get(getArtistKey(best)) || 0) === 0 ? 0.035 : 0)
        + ([...getGenres(best)][0] && !genreCounts.has([...getGenres(best)][0]) ? 0.02 : 0)
        - (getArtistKey(best) === lastArtist ? 0.06 : 0) : -Infinity
      if (adjusted > bestAdjusted) return candidate
      if (adjusted === bestAdjusted && stableHash(`${refreshSeed}:${getSongIdentity(candidate)}`)
        < stableHash(`${refreshSeed}:${getSongIdentity(best)}`)) return candidate
      return best
    }, null)
    const selectedIndex = remaining.indexOf(selectedCandidate)
    remaining.splice(selectedIndex, 1)
    selected.push(selectedCandidate)

    const selectedArtist = getArtistKey(selectedCandidate)
    artistCounts.set(selectedArtist, (artistCounts.get(selectedArtist) || 0) + 1)
    const selectedGenre = [...getGenres(selectedCandidate)][0]
    if (selectedGenre) genreCounts.set(selectedGenre, (genreCounts.get(selectedGenre) || 0) + 1)
    consecutiveArtistCount = selectedArtist === lastArtist ? consecutiveArtistCount + 1 : 1
    lastArtist = selectedArtist
  }

  return selected
}

const rankCandidates = ({ candidates, sourceSong, history, likedSongs, notInterested, recentIds, skipEvents }) => dedupeSongs(candidates)
  .filter((candidate) => candidate.id && candidate.audio && getSongIdentity(candidate) !== getSongIdentity(sourceSong))
  .map((candidate) => ({
    ...candidate,
    score: scoreRecommendationCandidate({ candidate, sourceSong, history, likedSongs, notInterested, recentIds, skipEvents })
  }))
  .filter((candidate) => Number.isFinite(candidate.score))
  .sort((first, second) => second.score - first.score || getSongIdentity(first).localeCompare(getSongIdentity(second)))

export const buildUpNextQueue = async (sourceSong, apiClient, {
  targetUpcomingCount = 40,
  history = [],
  likedSongs = [],
  notInterested = [],
  recentIds = new Set(),
  skipEvents = [],
  onUpdate = () => {},
  maxConsecutiveArtist = 2,
  maxPerArtist = 4,
  refreshSeed = ''
} = {}) => {
  if (!sourceSong) return []

  const target = Math.max(0, Number(targetUpcomingCount) || 0)
  const normalizedSource = normalizeRecommendationSong(sourceSong)
  const candidatePool = []
  const seen = new Set([getSongIdentity(normalizedSource)])
  const sourceLanguage = getSongLanguage(normalizedSource)
  const historyCandidates = Array.isArray(history) ? history : []
  const likedCandidates = Array.isArray(likedSongs) ? likedSongs : []
  const consideredBySource = {}
  const acceptedBySource = {}

  const publish = (stage) => {
    const ranked = rankCandidates({
      candidates: candidatePool,
      sourceSong: normalizedSource,
      history: historyCandidates,
      likedSongs: likedCandidates,
      notInterested,
      recentIds,
      skipEvents
    })
    const diversified = diversifyRecommendationCandidates(ranked, target, { maxConsecutiveArtist, maxPerArtist, refreshSeed })
    const queue = [normalizedSource, ...diversified]
    try {
      onUpdate(queue, { stage, count: diversified.length, target, consideredBySource, acceptedBySource })
    } catch {
      // UI updates must not interrupt candidate collection.
    }
  }

  const addCandidates = (candidates, stage) => {
    const candidateList = Array.isArray(candidates) ? candidates : []
    consideredBySource[stage] = (consideredBySource[stage] || 0) + candidateList.length
    let added = 0

    for (const candidate of candidateList) {
      const song = normalizeRecommendationSong(candidate)
      const identity = getSongIdentity(song)
      if (!song.id || !song.audio || !identity || seen.has(identity)) continue
      if (getNotInterestedIds(notInterested).has(String(song.id))) continue

      candidatePool.push({ ...song, recommendationSource: stage })
      seen.add(identity)
      added += 1
    }

    acceptedBySource[stage] = (acceptedBySource[stage] || 0) + added
    if (added) publish(stage)
  }

  if (target > 0 && apiClient) {
    try {
      await fetchRecommendationCandidates(sourceSong, apiClient, (candidates, stage) => {
        addCandidates(candidates, stage)
        return candidatePool.length >= target
      })
    } catch {
      // Continue to fallback sources when recommendations are unavailable.
    }

    addCandidates([...likedCandidates, ...historyCandidates], 'user library and history')

    if (candidatePool.length < target) {
      const artist = getPrimaryArtistName(normalizedSource).split(',')[0].trim()
      const artistResults = await getSearchSongs(apiClient, artist, 50)
      addCandidates(artistResults, 'artist search')
    }

    if (candidatePool.length < target) {
      const album = typeof sourceSong.album === 'object'
        ? sourceSong.album?.name
        : sourceSong.album || sourceSong.more_info?.album
      const genre = [...getGenres(normalizedSource)][0]
      const contextQuery = album || [sourceLanguage !== 'unknown' ? sourceLanguage : '', genre || ''].filter(Boolean).join(' ')
      const relatedSongs = await getSearchSongs(apiClient, contextQuery, 50)
      addCandidates(relatedSongs, album ? 'album search' : 'language and genre search')
    }

    if (candidatePool.length < target) {
      const popularQueries = sourceLanguage !== 'unknown'
        ? [`trending ${sourceLanguage} songs`, `popular ${sourceLanguage} songs`]
        : ['trending songs', 'popular songs']
      const popularBatches = await Promise.all(popularQueries.map((query) => getSearchSongs(apiClient, query)))
      addCandidates(popularBatches.flat(), 'popular search')
    }
  } else {
    addCandidates([...likedCandidates, ...historyCandidates], 'user library and history')
  }

  const rankedCandidates = rankCandidates({
    candidates: candidatePool,
    sourceSong: normalizedSource,
    history: historyCandidates,
    likedSongs: likedCandidates,
    notInterested,
    recentIds,
    skipEvents
  })
  const recommendations = diversifyRecommendationCandidates(rankedCandidates, target, { maxConsecutiveArtist, maxPerArtist, refreshSeed })
  const queue = [normalizedSource, ...recommendations]

  if (recommendations.length < target) {
    console.info(`[Up Next] Built ${recommendations.length}/${target} upcoming songs; valid candidate sources were exhausted.`, {
      consideredBySource,
      acceptedBySource
    })
  }

  try {
    onUpdate(queue, { stage: 'complete', count: recommendations.length, target, acceptedBySource })
  } catch {
    // The completed queue is still returned if a UI callback fails.
  }

  return queue
}