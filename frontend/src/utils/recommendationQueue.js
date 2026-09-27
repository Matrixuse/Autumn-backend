import { getBestAudioUrl, getBestImageUrl } from './mediaQuality.js'
import { fetchRecommendationCandidates } from '../api/recommendations.js'

export const normalizeTitle = (name = '') => String(name)
  .toLowerCase()
  .replace(/\s*[([].*?[)\]]/g, ' ')
  .replace(/\s*[-–—]\s*(?:(?:feat(?:uring)?|ft)\.?\s+.*|.*\b(?:remix|acoustic|slowed|sped\s*up|nightcore|instrumental|live|reverb)\b.*)$/i, ' ')
  .replace(/[^a-z0-9]/g, '')
  .trim()

export const getPrimaryArtistName = (song = {}) => {
  const primaryArtist = song.artists?.primary?.[0]
  const allArtist = song.artists?.all?.[0]
  return primaryArtist?.name || primaryArtist?.title || allArtist?.name || allArtist?.title
    || song.primaryArtists || song.artist || song.subtitle || ''
}

const getArtistKey = (song = {}) => {
  const primaryArtist = song.artists?.primary?.[0]
  const artistName = getPrimaryArtistName(song).trim().toLowerCase()
  return primaryArtist?.id ? `id:${primaryArtist.id}` : artistName ? `name:${artistName}` : `song:${song.id}`
}

const getSongLanguage = (song = {}) => String(song.language || song.lang || song.more_info?.language || '')
  .trim()
  .toLowerCase()

export const normalizeRecommendationSong = (song = {}) => ({
  ...song,
  id: song.id || song._id,
  title: song.title || song.name || 'Unknown Track',
  artist: getPrimaryArtistName(song) || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
  audio: getBestAudioUrl(song.audio || song.downloadUrl) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  language: getSongLanguage(song) || 'unknown'
})

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

const fisherYatesShuffle = (items) => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
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

export const buildUpNextQueue = async (sourceSong, apiClient, {
  targetLength = 50,
  history = [],
  onUpdate = () => {},
  maxPerArtist = 2,
  maxPerTitle = 1
} = {}) => {
  if (!sourceSong) return []

  const target = Math.max(1, Number(targetLength) || 50)
  const normalizedSource = normalizeRecommendationSong(sourceSong)
  const primaryQueue = [normalizedSource]
  const supplementalPool = []
  const seenIds = new Set(normalizedSource.id ? [String(normalizedSource.id)] : [])
  const sourceTitle = normalizeTitle(normalizedSource.title)
  const titleCounts = new Map(sourceTitle ? [[sourceTitle, 1]] : [])
  const artistCounts = new Map([[getArtistKey(normalizedSource), 1]])
  const sourceLanguage = getSongLanguage(normalizedSource)
  const lockToEnglish = sourceLanguage === 'english'
  const historyCandidates = Array.isArray(history) ? history : []
  const consideredBySource = {}
  const acceptedBySource = {}

  const publish = (stage) => {
    const queue = [...primaryQueue, ...fisherYatesShuffle(supplementalPool)].slice(0, target)
    try {
      onUpdate(queue, { stage, count: queue.length, target })
    } catch {
      // UI updates must not interrupt candidate collection.
    }
  }

  const addCandidates = (candidates, destination, stage, sameLanguage = false, prioritizePopularity = false) => {
    const candidateList = Array.isArray(candidates) ? candidates : []
    consideredBySource[stage] = (consideredBySource[stage] || 0) + candidateList.length
    const orderedCandidates = prioritizePopularity
      ? [...candidateList].sort((first, second) => (Number(second?.playCount || second?.play_count) || 0) - (Number(first?.playCount || first?.play_count) || 0))
      : candidateList
    let added = 0

    for (const candidate of orderedCandidates || []) {
      if (primaryQueue.length + supplementalPool.length >= target) break
      if (!candidate?.id || seenIds.has(String(candidate.id))) continue

      let song
      try {
        song = normalizeRecommendationSong(candidate)
      } catch {
        continue
      }
      const titleKey = normalizeTitle(song.title)
      if (!titleKey || (titleCounts.get(titleKey) || 0) >= maxPerTitle) continue
      if (lockToEnglish && song.language !== 'english') continue
      if (sameLanguage && sourceLanguage !== 'unknown' && song.language !== sourceLanguage) continue

      const artistKey = getArtistKey(song)
      if ((artistCounts.get(artistKey) || 0) >= maxPerArtist) continue

      destination.push(song)
      seenIds.add(String(song.id))
      titleCounts.set(titleKey, (titleCounts.get(titleKey) || 0) + 1)
      artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1)
      added += 1
    }

    acceptedBySource[stage] = (acceptedBySource[stage] || 0) + added
    if (added) publish(stage)
  }

  if (target > 1 && apiClient) {
    try {
      await fetchRecommendationCandidates(sourceSong, apiClient, (candidates, stage) => {
        addCandidates(candidates, primaryQueue, stage)
        return primaryQueue.length >= target
      })
    } catch {
      // Continue to fallback sources when recommendations are unavailable.
    }
    publish('recommendations')

    if (primaryQueue.length + supplementalPool.length < target) {
      addCandidates(historyCandidates, supplementalPool, 'listening history')
    }

    if (primaryQueue.length + supplementalPool.length < target) {
      const album = typeof sourceSong.album === 'object'
        ? sourceSong.album?.name
        : sourceSong.album || sourceSong.more_info?.album
      const relatedQuery = album || `${normalizedSource.title} ${sourceLanguage !== 'unknown' ? sourceLanguage : ''} songs`.trim()
      const relatedSongs = await getSearchSongs(apiClient, relatedQuery)
      addCandidates(relatedSongs, supplementalPool, 'album search', true)
    }

    if (primaryQueue.length + supplementalPool.length < target) {
      const popularQueries = sourceLanguage !== 'unknown'
        ? [`trending ${sourceLanguage} songs`, `popular ${sourceLanguage} songs`, `top ${sourceLanguage} songs`]
        : ['trending songs', 'popular songs', `${getPrimaryArtistName(sourceSong)} songs`].filter(Boolean)
      const popularBatches = await Promise.all(popularQueries.map((query) => getSearchSongs(apiClient, query)))
      addCandidates(popularBatches.flat(), supplementalPool, 'popular search', true, true)
    }
  }

  const result = [...primaryQueue, ...fisherYatesShuffle(supplementalPool)].slice(0, target)
  if (result.length < target) {
    console.info(`[Up Next] Built ${result.length}/${target} songs; candidate sources were exhausted after diversity and language filters.`, {
      consideredBySource,
      acceptedBySource
    })
  }
  try {
    onUpdate(result, { stage: 'complete', count: result.length, target, acceptedBySource })
  } catch {
    // The completed queue is still returned if a UI callback fails.
  }
  return result
}
