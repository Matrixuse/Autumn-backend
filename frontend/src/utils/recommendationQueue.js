import { getBestAudioUrl, getBestImageUrl } from './mediaQuality.js'
import { fetchRecommendationCandidates } from '../api/recommendations.js'

export const RECOMMENDATION_WEIGHTS = Object.freeze({
  genre: 0.20,
  mood: 0.15,
  artist: 0.15,
  userPreference: 0.20,
  history: 0.10,
  audioCharacteristics: 0.10,
  album: 0.10
})

const normalizeText = (value = '') => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const LANGUAGE_ALIASES = new Map([
  ['english', 'english'], ['en', 'english'], ['eng', 'english'], ['england', 'english'], ['uk', 'english'],
  ['hindi', 'hindi'], ['hi', 'hindi'], ['hin', 'hindi'], ['devanagari', 'hindi'],
  ['japanese', 'japanese'], ['ja', 'japanese'], ['jpn', 'japanese'], ['jp', 'japanese'],
  ['punjabi', 'punjabi'], ['pa', 'punjabi'], ['panjabi', 'punjabi'],
  ['tamil', 'tamil'], ['ta', 'tamil'], ['telugu', 'telugu'], ['te', 'telugu'],
  ['marathi', 'marathi'], ['mr', 'marathi'], ['bengali', 'bengali'], ['bn', 'bengali'],
  ['gujarati', 'gujarati'], ['gu', 'gujarati'], ['kannada', 'kannada'], ['kn', 'kannada'],
  ['malayalam', 'malayalam'], ['ml', 'malayalam'], ['odia', 'odia'], ['or', 'odia'], ['urdu', 'urdu'], ['ur', 'urdu']
])

const canonicalizeLanguage = (value = '') => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw || raw === 'unknown' || raw === 'null') return 'unknown'
  const compact = raw.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!compact) return 'unknown'
  const direct = compact.split(' ').filter(Boolean)
  for (const token of direct) {
    const mapped = LANGUAGE_ALIASES.get(token)
    if (mapped) return mapped
  }
  for (const [alias, canonical] of LANGUAGE_ALIASES.entries()) {
    if (compact.includes(alias)) return canonical
  }
  return compact.includes('english') ? 'english'
    : compact.includes('hindi') ? 'hindi'
      : compact.includes('japanese') ? 'japanese'
        : compact.includes('punjabi') ? 'punjabi'
          : compact.includes('tamil') ? 'tamil'
            : compact.includes('telugu') ? 'telugu'
              : 'unknown'
}

const createSeededRandom = (seed = '') => {
  let state = 0
  for (let index = 0; index < String(seed || 'autumn').length; index += 1) {
    state = (state * 31 + String(seed || 'autumn').charCodeAt(index)) >>> 0
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const shuffleRecommendationList = (items = [], { rng = Math.random, seed = '' } = {}) => {
  const list = Array.isArray(items) ? [...items] : []
  if (list.length < 2) return list
  const random = typeof rng === 'function' ? rng : createSeededRandom(seed || String(rng) || 'autumn')
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[list[index], list[swapIndex]] = [list[swapIndex], list[index]]
  }
  return list
}

const hollywoodArtistHints = [
  'adele', 'alan walker', 'billie eilish', 'bruno mars', 'coldplay', 'dua lipa', 'ed sheeran',
  'harry styles', 'imagine dragons', 'justin bieber', 'one direction', 'taylor swift', 'the weeknd'
]
const hollywoodTitleHints = ['as it was', 'bad guy', 'flowers', 'levitating', 'shape of you']

const getRecommendationLanguage = (song = {}) => {
  const language = getSongLanguage(song)
  if (language !== 'unknown') return language
  const title = normalizeText(song.title || song.name)
  const artist = normalizeText(getPrimaryArtistName(song))
  return hollywoodArtistHints.some((hint) => artist.includes(hint))
    || hollywoodTitleHints.some((hint) => title.includes(hint))
    ? 'english'
    : 'unknown'
}

const shouldRetainSongLanguage = (sourceSong = {}, candidateSong = {}, allowMultilingual = false) => {
  const sourceLanguage = getRecommendationLanguage(sourceSong)
  const candidateLanguage = getRecommendationLanguage(candidateSong)
  if (candidateLanguage === 'unknown') return false
  if (sourceLanguage === 'english') return candidateLanguage === 'english'
  if (allowMultilingual) return true
  if (sourceLanguage === 'unknown') return false
  return candidateLanguage === sourceLanguage
}

export const resolveRecommendationLanguage = (sourceSong = {}, {
  history = [],
  likedSongs = [],
  userPreferences = {}
} = {}) => {
  const sourceLanguage = getRecommendationLanguage(sourceSong)
  if (sourceLanguage !== 'unknown') return sourceLanguage

  const preferences = userPreferences && typeof userPreferences === 'object' ? userPreferences : {}
  const preferredLanguage = canonicalizeLanguage(
    preferences.preferredLanguage || preferences.language || preferences.recommendationLanguage
  )
  if (preferredLanguage !== 'unknown') return preferredLanguage

  const languageCounts = new Map()
  const preferenceTracks = [
    ...(Array.isArray(history) ? history : []),
    ...(Array.isArray(likedSongs) ? likedSongs : [])
  ]
  for (const song of preferenceTracks) {
    const language = getSongLanguage(song)
    if (language !== 'unknown') languageCounts.set(language, (languageCounts.get(language) || 0) + 1)
  }
  const rankedLanguages = [...languageCounts.entries()].sort((first, second) => second[1] - first[1])
  const totalKnown = rankedLanguages.reduce((total, [, count]) => total + count, 0)
  const [dominantLanguage, dominantCount] = rankedLanguages[0] || []
  return dominantCount >= 3 && dominantCount / totalKnown >= 0.65 ? dominantLanguage : 'unknown'
}

export const validateGeneratedQueue = (queue = [], {
  sourceSong = null,
  targetLength = 50,
  requireMinimum = true,
  allowMultilingual = false
} = {}) => {
  const list = Array.isArray(queue) ? queue : []
  const seen = new Set()
  const issues = []
  const validSongs = []

  for (const song of list) {
    if (!song || !song.id || !song.audio) {
      issues.push('missing playback data')
      continue
    }
    const identity = getSongIdentity(song)
    if (!identity || seen.has(identity)) {
      issues.push('duplicate track')
      continue
    }
    seen.add(identity)

    const isSourceSong = sourceSong && identity === getSongIdentity(sourceSong)
    if (sourceSong && !isSourceSong && !shouldRetainSongLanguage(sourceSong, song, allowMultilingual)) {
      issues.push(`language mismatch:${getSongIdentity(song)}`)
      continue
    }

    validSongs.push(song)
  }

  if (sourceSong) {
    const sourceIdentity = getSongIdentity(sourceSong)
    const hasSourceTrack = list.some((song) => getSongIdentity(song) === sourceIdentity)
    if (!hasSourceTrack && list.length && list[0] && String(list[0].id || '') !== String(sourceSong.id || '')) {
      // Candidate-only validation is allowed; actual queue generation will always include the source track.
    }
  }

  const pass = !issues.length && (!requireMinimum || validSongs.length >= Math.max(0, targetLength))
  return {
    isValid: pass,
    validSongs,
    issues,
    uniqueCount: validSongs.length
  }
}

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

export const getSongLanguage = (song = {}) => {
  const explicit = canonicalizeLanguage(song?.language || song?.lang || song?.more_info?.language || song?.metadata?.language)
  if (explicit !== 'unknown') return explicit
  if (typeof song?.title === 'string' || typeof song?.name === 'string') {
    const metadataText = `${song?.title || song?.name || ''} ${song?.artist || song?.subtitle || song?.primaryArtists || ''}`
    if (typeof song?.title === 'string' && /[\u3040-\u30ff]/u.test(song.title)) return 'japanese'
    if (typeof song?.artist === 'string' && /[\u3040-\u30ff]/u.test(song.artist)) return 'japanese'
    if (typeof metadataText === 'string' && /[\u3040-\u30ff]/u.test(metadataText)) return 'japanese'
    if (typeof song?.title === 'string' && song.title && /[A-Za-z]/.test(song.title) && !/[\u0900-\u09FF]/u.test(song.title)) {
      const likelyEnglish = Number((song.title.match(/[A-Za-z]{4,}/g) || []).length) >= 2 || /\b(?:the|and|for|with|you|love|night|time|day|dream|summer|winter)\b/i.test(song.title)
      if (likelyEnglish) return 'english'
    }
  }
  return 'unknown'
}

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

const getArtistIds = (song = {}) => [
  ...(Array.isArray(song.artists?.primary) ? song.artists.primary : []),
  ...(Array.isArray(song.artists?.all) ? song.artists.all : []),
  ...(Array.isArray(song.artists?.featured) ? song.artists.featured : [])
].map((artist) => String(artist?.id || '')).filter(Boolean)

const matchesFollowedArtist = (song, followedArtists = []) => {
  const followedIds = new Set(followedArtists.map((artist) => String(artist?.id || artist?._id || '')).filter(Boolean))
  if (getArtistIds(song).some((artistId) => followedIds.has(artistId))) return true

  const normalizeArtistName = (value) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  const candidateNames = new Set([
    ...getArtistNames(song),
    ...(Array.isArray(song.artists?.primary) ? song.artists.primary : []).map((artist) => artist?.name || artist?.title),
    ...(Array.isArray(song.artists?.all) ? song.artists.all : []).map((artist) => artist?.name || artist?.title),
    song.artist,
    song.primaryArtists,
    song.subtitle
  ].map(normalizeArtistName).filter(Boolean))
  return followedArtists.some((artist) => candidateNames.has(normalizeArtistName(artist?.name || artist?.title)))
}

const getGenres = (song = {}) => {
  const genres = Array.isArray(song.genre) ? song.genre : [song.genre, ...(Array.isArray(song.genres) ? song.genres : [])]
  return new Set(genres.map(normalizeText).filter(Boolean))
}

const getMoodTags = (song = {}) => {
  const fields = [song.mood, song.moods, song.vibe, song.vibes, song.tags, song.style, song.styles, song.more_info?.mood]
  return new Set(fields.flatMap((field) => Array.isArray(field) ? field : [field])
    .map((item) => typeof item === 'string' ? item : item?.name || item?.title || item?.label || '')
    .map(normalizeText)
    .filter(Boolean))
}

const getAudioFeatures = (song = {}) => {
  const records = [song.audioFeatures, song.audio_features, song.features, song.more_info?.audioFeatures, song.more_info?.audio_features, song.more_info, song]
  const featureNames = ['energy', 'danceability', 'valence', 'acousticness', 'instrumentalness', 'speechiness', 'liveness', 'tempo']
  const features = {}

  for (const name of featureNames) {
    for (const record of records) {
      const rawValue = record?.[name]
      const numeric = rawValue === null || rawValue === undefined || rawValue === '' ? NaN : Number(rawValue)
      if (!Number.isFinite(numeric) || numeric < 0) continue
      features[name] = name !== 'tempo' && numeric > 1 && numeric <= 100 ? numeric / 100 : numeric
      break
    }
  }

  return features
}

const getSetSimilarity = (firstSet, secondSet) => {
  if (!firstSet.size || !secondSet.size) return null
  const intersection = [...firstSet].filter((value) => secondSet.has(value)).length
  return intersection / new Set([...firstSet, ...secondSet]).size
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
  if (totalWeight <= 0) return null
  return available.reduce((total, signal) => total + signal.value * signal.weight, 0) / totalWeight
}

const getArtistSimilarityScore = (candidate, source) => {
  const candidateArtists = getArtistNames(candidate)
  const sourceArtists = getArtistNames(source)
  if (!candidateArtists.length || !sourceArtists.length) return null
  if (candidateArtists.some((artist) => sourceArtists.includes(artist))) return 0.9

  const relatedArtistIds = new Set((source.relatedArtists || []).map((artist) => String(artist?.id || '')).filter(Boolean))
  const candidateArtistIds = [
    ...(Array.isArray(candidate.artists?.primary) ? candidate.artists.primary : []),
    ...(Array.isArray(candidate.artists?.all) ? candidate.artists.all : [])
  ].map((artist) => String(artist?.id || '')).filter(Boolean)
  return candidateArtistIds.some((artistId) => relatedArtistIds.has(artistId)) ? 0.72 : 0.12
}

const getAlbumSimilarityScore = (candidate, source) => {
  const sourceAlbum = normalizeText(typeof source.album === 'object' ? source.album?.name : source.album || source.more_info?.album)
  const candidateAlbum = normalizeText(typeof candidate.album === 'object' ? candidate.album?.name : candidate.album || candidate.more_info?.album)
  if (!sourceAlbum || !candidateAlbum) return null
  if (sourceAlbum === candidateAlbum) return 1
  return getArtistSimilarityScore(candidate, source) >= 0.72 ? 0.28 : 0.08
}

const getPreferenceScore = (candidate, likedSongs = [], followedArtists = []) => {
  const candidateArtists = getArtistNames(candidate)
  const exactLike = likedSongs.some((song) => sameTrack(song, candidate))
  if (exactLike) return 1

  const likedArtist = likedSongs.some((song) => getArtistNames(song).some((artist) => candidateArtists.includes(artist)))
  if (likedArtist) return 0.78
  if (matchesFollowedArtist(candidate, followedArtists)) return 0.68
  return likedSongs.length || followedArtists.length ? 0.12 : null
}

const getHistoryRelevanceScore = (candidate, history = []) => {
  if (!history.length) return null
  const artists = getArtistNames(candidate)
  const artistPlays = history.reduce((count, item) => count + Number(
    artists.some((artist) => getArtistNames(item).includes(artist))
  ), 0)
  const trackPlays = history.reduce((count, item) => count + Number(sameTrack(item, candidate)), 0)
  const artistScore = Math.min(1, artistPlays / Math.max(3, history.length * 0.35))
  const trackScore = Math.min(1, trackPlays / 3)
  return Math.max(artistScore, trackScore)
}

const getAudioCharacteristicsSimilarity = (candidate, source) => {
  const candidateFeatures = getAudioFeatures(candidate)
  const sourceFeatures = getAudioFeatures(source)
  const similarities = Object.keys(sourceFeatures).flatMap((key) => {
    if (!(key in candidateFeatures)) return []
    const difference = key === 'tempo'
      ? Math.abs(candidateFeatures[key] - sourceFeatures[key]) / Math.max(100, candidateFeatures[key], sourceFeatures[key])
      : Math.abs(candidateFeatures[key] - sourceFeatures[key])
    return [Math.max(0, 1 - difference)]
  })
  if (!similarities.length) return null
  return similarities.reduce((total, similarity) => total + similarity, 0) / similarities.length
}

const getDiscoveryScore = (candidate, history = []) => {
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

export const scoreRecommendationCandidate = ({ candidate, sourceSong, history = [], likedSongs = [], followedArtists = [], notInterested = [], recentIds = new Set(), skipEvents = [], scoringWeights = RECOMMENDATION_WEIGHTS }) => {
  const rawSource = sourceSong || {}
  const rawCandidate = candidate || {}
  const source = normalizeRecommendationSong(rawSource)
  const song = normalizeRecommendationSong(rawCandidate)
  if (!song.title || song.title === 'Unknown Track') return -Infinity
  const sourceHasMeaningfulMetadata = !!(rawSource.title || rawSource.name || rawSource.artist || rawSource.primaryArtists || rawSource.subtitle || rawSource.album || rawSource.language || rawSource.lang || rawSource.more_info?.language || rawSource.genre || rawSource.genres || rawSource.mood || rawSource.moods || rawSource.audioFeatures || rawSource.features)
  const candidateHasMeaningfulMetadata = !!(rawCandidate.title || rawCandidate.name || rawCandidate.artist || rawCandidate.primaryArtists || rawCandidate.subtitle || rawCandidate.album || rawCandidate.language || rawCandidate.lang || rawCandidate.more_info?.language || rawCandidate.genre || rawCandidate.genres || rawCandidate.mood || rawCandidate.moods || rawCandidate.audioFeatures || rawCandidate.features)
  if (!sourceHasMeaningfulMetadata || !candidateHasMeaningfulMetadata) return 0.15
  const recentIdSet = recentIds instanceof Set ? recentIds : new Set(Array.isArray(recentIds) ? recentIds.map((value) => String(value)) : [])
  const songId = String(song.id || '')
  const sourceId = String(source.id || '')
  if (songId && sourceId && songId === sourceId) return -Infinity
  if (getNotInterestedIds(notInterested).has(songId)) return -Infinity

  const weights = { ...RECOMMENDATION_WEIGHTS, ...(scoringWeights || {}) }
  const components = [
    { value: getSetSimilarity(getGenres(source), getGenres(song)), weight: weights.genre },
    { value: getSetSimilarity(getMoodTags(source), getMoodTags(song)), weight: weights.mood },
    { value: getArtistSimilarityScore(song, source), weight: weights.artist },
    { value: getPreferenceScore(song, likedSongs, followedArtists), weight: weights.userPreference },
    { value: getHistoryRelevanceScore(song, history), weight: weights.history },
    { value: getAudioCharacteristicsSimilarity(song, source), weight: weights.audioCharacteristics },
    { value: getAlbumSimilarityScore(song, source), weight: weights.album }
  ]
  const normalizedScore = averageSignals(components) ?? 0.2
  const recentPenalty = songId && recentIdSet.has(songId) ? 0.18 : 0
  const skipPenalty = getSkipPenalty(song, skipEvents)
  const sourceVersion = getSongVersionToken(source)
  const candidateVersion = getSongVersionToken(song)
  const versionPenalty = sourceVersion && candidateVersion && sourceVersion !== candidateVersion ? 0.04 : 0
  const discoveryAdjustment = (getDiscoveryScore(song, history) - 0.5) * 0.04
  const popularity = getPopularityScore(song)
  const popularityAdjustment = popularity === null ? 0 : (popularity - 0.5) * 0.02
  const recommendationBonus = song.recommendationSource === 'suggestions' ? 0.03 : 0

  return Math.max(0, Math.min(1, normalizedScore + discoveryAdjustment + popularityAdjustment + recommendationBonus - recentPenalty - skipPenalty - versionPenalty))
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
  targetUpcomingCount = 50,
  refillThreshold = targetUpcomingCount - 1,
  autoplayEnabled = true
} = {}) => {
  const upcomingCount = getUpcomingTrackCount(queue, currentIndex)
  return autoplayEnabled && upcomingCount < targetUpcomingCount && upcomingCount <= refillThreshold
}

export const isRecommendationRequestCurrent = (requestId, activeRequestId, autoplayEnabled = true) => (
  autoplayEnabled && requestId === activeRequestId
)

export const isPlayRequestCurrent = (requestId, activeRequestId) => (
  Number.isInteger(requestId) && requestId === activeRequestId
)

export const claimRecommendationEventKey = (seenKeys, key) => {
  if (!key) return true
  if (seenKeys.has(key)) return false
  seenKeys.add(key)
  return true
}

export const mergeRecommendationTracks = (queue = [], currentIndex = -1, candidates = [], targetUpcomingCount = 50) => {
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

export const buildIndependentQueueSeed = (selectedTrack, currentQueue = [], preserveManualAfterIndex = -1) => {
  const sourceTrack = normalizeRecommendationSong(selectedTrack)
  if (!sourceTrack.id) return []

  const nextQueue = [{ ...sourceTrack, queueSource: 'seed' }]
  const seen = new Set([getSongIdentity(sourceTrack)])
  const queue = Array.isArray(currentQueue) ? currentQueue : []
  const startIndex = Number.isInteger(preserveManualAfterIndex) ? preserveManualAfterIndex : -1

  queue.forEach((track, index) => {
    if (index <= startIndex || track?.queueSource !== 'manual' || !track.id) return
    const identity = getSongIdentity(track)
    if (!identity || seen.has(identity)) return
    seen.add(identity)
    nextQueue.push(track)
  })

  return nextQueue
}

export const diversifyRecommendationCandidates = (rankedCandidates = [], limit = 40, {
  maxConsecutiveArtist = 2,
  maxPerArtist = 4,
  refreshSeed = '',
  rng
} = {}) => {
  const remaining = Array.isArray(rankedCandidates) ? [...rankedCandidates] : []
  const selected = []
  const artistCounts = new Map()
  const genreCounts = new Map()
  const recentArtists = []
  let lastArtist = ''
  let consecutiveArtistCount = 0
  const target = Math.max(0, Number(limit) || 0)
  const random = typeof rng === 'function' ? rng : createSeededRandom(`${refreshSeed}:weighted-selection`)

  while (remaining.length && selected.length < target) {
    const eligible = remaining.filter((candidate) => {
      const artist = getArtistKey(candidate)
      return (artist !== lastArtist || consecutiveArtistCount < maxConsecutiveArtist)
        && !recentArtists.slice(-3).includes(artist)
        && (artistCounts.get(artist) || 0) < maxPerArtist
    })
    const belowArtistCap = remaining.filter((candidate) => (artistCounts.get(getArtistKey(candidate)) || 0) < maxPerArtist)
    const pool = (eligible.length ? eligible : belowArtistCap.length ? belowArtistCap : remaining).map((candidate) => {
      const artist = getArtistKey(candidate)
      const genre = [...getGenres(candidate)][0] || ''
      const artistBonus = (artistCounts.get(artist) || 0) === 0 ? 0.035 : 0
      const genreBonus = genre && !genreCounts.has(genre) ? 0.02 : 0
      const sequencePenalty = artist && artist === lastArtist ? 0.06 : 0
      return { candidate, score: Number(candidate.score || 0) + artistBonus + genreBonus - sequencePenalty }
    }).sort((first, second) => second.score - first.score)
    const topScore = pool[0].score
    const closeMatches = pool.filter((item, index) => index < 5 && item.score >= topScore - 0.08)
    const weightedPool = closeMatches.map((item) => ({
      ...item,
      weight: Math.exp((item.score - topScore) / 0.05)
    }))
    const totalWeight = weightedPool.reduce((total, item) => total + item.weight, 0)
    let remainingWeight = random() * totalWeight
    let selectedCandidate = weightedPool[weightedPool.length - 1].candidate
    for (const item of weightedPool) {
      remainingWeight -= item.weight
      if (remainingWeight <= 0) {
        selectedCandidate = item.candidate
        break
      }
    }
    const selectedIndex = remaining.indexOf(selectedCandidate)
    remaining.splice(selectedIndex, 1)
    selected.push(selectedCandidate)

    const selectedArtist = getArtistKey(selectedCandidate)
    artistCounts.set(selectedArtist, (artistCounts.get(selectedArtist) || 0) + 1)
    recentArtists.push(selectedArtist)
    if (recentArtists.length > 3) recentArtists.shift()
    const selectedGenre = [...getGenres(selectedCandidate)][0]
    if (selectedGenre) genreCounts.set(selectedGenre, (genreCounts.get(selectedGenre) || 0) + 1)
    consecutiveArtistCount = selectedArtist === lastArtist ? consecutiveArtistCount + 1 : 1
    lastArtist = selectedArtist
  }

  return selected
}

const rankCandidates = ({ candidates, sourceSong, history, likedSongs, followedArtists, notInterested, recentIds, skipEvents, allowMultilingual = false, scoringWeights = RECOMMENDATION_WEIGHTS }) => dedupeSongs(candidates)
  .filter((candidate) => candidate.id && candidate.audio && getSongIdentity(candidate) !== getSongIdentity(sourceSong))
  .filter((candidate) => shouldRetainSongLanguage(sourceSong, candidate, allowMultilingual))
  .map((candidate) => ({
    ...candidate,
    score: scoreRecommendationCandidate({ candidate, sourceSong, history, likedSongs, followedArtists, notInterested, recentIds, skipEvents, scoringWeights })
  }))
  .filter((candidate) => Number.isFinite(candidate.score))
  .sort((first, second) => second.score - first.score || getSongIdentity(first).localeCompare(getSongIdentity(second)))

const interleaveRecommendationSources = (candidates = [], limit = 50) => {
  const sources = new Map()
  for (const candidate of candidates) {
    const source = candidate.recommendationSource || 'recommendations'
    if (!sources.has(source)) sources.set(source, [])
    sources.get(source).push(candidate)
  }

  const mixed = []
  while (mixed.length < limit) {
    let added = false
    for (const sourceCandidates of sources.values()) {
      const candidate = sourceCandidates.shift()
      if (!candidate) continue
      mixed.push(candidate)
      added = true
      if (mixed.length >= limit) break
    }
    if (!added) break
  }
  return mixed
}

const flattenCollectionSongs = (collections = []) => {
  const songs = []
  const visit = (value, inheritedMood = '') => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, inheritedMood))
      return
    }
    if (!value || typeof value !== 'object') return

    const collectionMood = value.mood || value.moodName || value.vibe || inheritedMood
    const nestedCollections = ['songs', 'tracks', 'items', 'entries']
      .flatMap((key) => Array.isArray(value[key]) ? [value[key]] : [])
    if (nestedCollections.length) {
      nestedCollections.forEach((items) => visit(items, collectionMood))
      return
    }
    if (value.id || value._id || value.musicId || value.trackId) {
      songs.push(collectionMood && !value.mood && !value.moods ? { ...value, mood: collectionMood } : value)
    }
  }

  visit(collections)
  return dedupeSongs(songs)
}

export const buildUpNextQueue = async (sourceSong, apiClient, {
  targetUpcomingCount = 50,
  history = [],
  recentlyPlayedSongs = [],
  likedSongs = [],
  collections = [],
  moodCollections = [],
  availableSongs = [],
  candidateSources = {},
  followedArtists = [],
  notInterested = [],
  recentIds = new Set(),
  skipEvents = [],
  userPreferences = {},
  scoringWeights = RECOMMENDATION_WEIGHTS,
  onUpdate = () => {},
  maxConsecutiveArtist = 2,
  maxPerArtist = 4,
  refreshSeed = '',
  shuffleSeed = '',
  rng
} = {}) => {
  if (!sourceSong) return []

  const target = Math.max(0, Number(targetUpcomingCount) || 0)
  const normalizedSource = normalizeRecommendationSong(sourceSong)
  const candidatePool = []
  const seen = new Set([getSongIdentity(normalizedSource)])
  const historyCandidates = [
    ...(Array.isArray(history) ? history : []),
    ...(Array.isArray(recentlyPlayedSongs) ? recentlyPlayedSongs : [])
  ]
  const likedCandidates = Array.isArray(likedSongs) ? likedSongs : []
  const preferences = userPreferences && typeof userPreferences === 'object' ? userPreferences : {}
  const sourceLanguage = resolveRecommendationLanguage(normalizedSource, { history: historyCandidates, likedSongs: likedCandidates, userPreferences: preferences })
  const languageSource = sourceLanguage === 'unknown' ? normalizedSource : { ...normalizedSource, language: sourceLanguage }
  const allowMultilingual = preferences.multilingualRecommendations === true
  const collectionCandidates = flattenCollectionSongs([collections, moodCollections])
  const catalogCandidates = flattenCollectionSongs(availableSongs)
  const consideredBySource = {}
  const acceptedBySource = {}

  const publish = (stage) => {
    const ranked = rankCandidates({
      candidates: candidatePool,
      sourceSong: languageSource,
      history: historyCandidates,
      likedSongs: likedCandidates,
      followedArtists,
      notInterested,
      recentIds,
      skipEvents,
      allowMultilingual,
      scoringWeights
    })
    const balancedCandidates = interleaveRecommendationSources(ranked, target)
    const recommendations = diversifyRecommendationCandidates(balancedCandidates, target, {
      maxConsecutiveArtist,
      maxPerArtist,
      refreshSeed: `${refreshSeed || shuffleSeed || 'autumn'}:${stage}`,
      rng
    })
    const queue = [normalizedSource, ...interleaveRecommendationSources(recommendations, target)]
    try {
      onUpdate(queue, { stage, count: recommendations.length, target, consideredBySource, acceptedBySource })
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
      if (!shouldRetainSongLanguage(languageSource, song, allowMultilingual)) continue

      candidatePool.push({ ...song, recommendationSource: stage })
      seen.add(identity)
      added += 1
    }

    acceptedBySource[stage] = (acceptedBySource[stage] || 0) + added
    if (added) publish(stage)
  }

  if (target > 0 && apiClient && (sourceLanguage !== 'unknown' || allowMultilingual)) {
    try {
      await fetchRecommendationCandidates(sourceSong, apiClient, (candidates, stage) => {
        addCandidates(candidates, stage)
        return candidatePool.length >= target
      })
    } catch {
      // Continue to fallback sources when recommendations are unavailable.
    }
  }

  addCandidates([...likedCandidates, ...historyCandidates], 'user library and history')
  addCandidates(collectionCandidates, 'user collections')
  addCandidates(catalogCandidates, 'available catalog')
  addCandidates(candidateSources.quickPicks, 'quick picks')
  addCandidates(candidateSources.mostListened, 'most listened')
  addCandidates(candidateSources.followedArtists, 'followed artists')
  addCandidates(candidateSources.moods, 'mood discovery')
  addCandidates(candidateSources.popular, 'most popular')

  if (target > 0 && apiClient && (sourceLanguage !== 'unknown' || allowMultilingual)) {
    const followedArtistQueries = (Array.isArray(followedArtists) ? followedArtists : [])
      .map((artist) => String(artist?.name || artist?.title || '').trim())
      .filter(Boolean)
      .slice(0, 5)
    const moodQueries = [...new Set([
      ...(Array.isArray(normalizedSource.mood) ? normalizedSource.mood : [normalizedSource.mood]),
      ...(Array.isArray(normalizedSource.moods) ? normalizedSource.moods : []),
      ...getGenres(normalizedSource)
    ].map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 3)
    const discoveryBatches = await Promise.all([
      ...followedArtistQueries.map((artist) => getSearchSongs(apiClient, artist, 12)),
      ...moodQueries.map((mood) => getSearchSongs(apiClient, `${sourceLanguage} ${mood} songs`, 12)),
      getSearchSongs(apiClient, `popular ${sourceLanguage} songs`, 24),
      getSearchSongs(apiClient, `trending ${sourceLanguage} songs`, 24)
    ])
    const followedCount = followedArtistQueries.length
    const moodCount = moodQueries.length
    followedArtistQueries.forEach((_, index) => addCandidates(discoveryBatches[index], 'followed artists'))
    moodQueries.forEach((_, index) => addCandidates(discoveryBatches[followedCount + index], 'mood discovery'))
    addCandidates(discoveryBatches[followedCount + moodCount], 'most popular')
    addCandidates(discoveryBatches[followedCount + moodCount + 1], 'most popular')

    if (candidatePool.length < target && !acceptedBySource['artist search']) {
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
  }

  const rankedCandidates = rankCandidates({
    candidates: candidatePool,
    sourceSong: languageSource,
    history: historyCandidates,
    likedSongs: likedCandidates,
    followedArtists,
    notInterested,
    recentIds,
    skipEvents,
    allowMultilingual,
    scoringWeights
  })
  const balancedCandidates = interleaveRecommendationSources(rankedCandidates, target)
  const diversifiedCandidates = diversifyRecommendationCandidates(balancedCandidates, target, {
    maxConsecutiveArtist,
    maxPerArtist,
    refreshSeed: `${refreshSeed || shuffleSeed || 'autumn'}:complete`,
    rng
  })
  const recommendations = interleaveRecommendationSources(diversifiedCandidates, target)
  const queue = [normalizedSource, ...recommendations]
  const validation = validateGeneratedQueue(queue, { sourceSong: languageSource, targetLength: target, requireMinimum: false, allowMultilingual })

  if (recommendations.length < target || !validation.isValid) {
    const fallbackCandidates = interleaveRecommendationSources(
      rankedCandidates.filter((candidate) => shouldRetainSongLanguage(languageSource, candidate, allowMultilingual)),
      target
    )
    const fallbackQueue = [normalizedSource, ...fallbackCandidates]
    const resetValidation = validateGeneratedQueue(fallbackQueue, { sourceSong: languageSource, targetLength: target, requireMinimum: false, allowMultilingual })
    if (resetValidation.isValid) {
      const fallbackRankedCandidates = resetValidation.validSongs.filter((song) => getSongIdentity(song) !== getSongIdentity(normalizedSource))
      const finalRecommendations = diversifyRecommendationCandidates(fallbackRankedCandidates, target, {
        maxConsecutiveArtist,
        maxPerArtist,
        refreshSeed: `${refreshSeed || shuffleSeed || 'autumn'}:fallback`,
        rng
      })
      const finalQueue = [normalizedSource, ...finalRecommendations]
      try {
        onUpdate(finalQueue, { stage: 'fallback', count: finalQueue.length - 1, target, acceptedBySource })
      } catch {
        // Safety queue must not interrupt playback.
      }
      return finalQueue
    }
  }

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