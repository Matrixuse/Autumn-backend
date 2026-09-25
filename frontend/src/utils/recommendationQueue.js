import { getBestAudioUrl, getBestImageUrl } from './mediaQuality.js'
import { fetchRecommendationCandidates } from '../api/recommendations.js'

export const normalizeTitle = (name = '') => String(name)
  .toLowerCase()
  .replace(/\s*[([].*?[)\]]/g, ' ')
  .replace(/\s*[-–—].*$/, '')
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

export const buildDiverseQueue = (sourceSong, candidates, { maxPerArtist = 2, maxPerTitle = 1, limit = 20 } = {}) => {
  if (!sourceSong) return []

  const queue = [sourceSong]
  const seenIds = new Set(sourceSong.id ? [String(sourceSong.id)] : [])
  const sourceTitle = normalizeTitle(sourceSong.title || sourceSong.name)
  const titleCounts = new Map(sourceTitle ? [[sourceTitle, 1]] : [])
  const artistCounts = new Map([[getArtistKey(sourceSong), 1]])
  const lockToEnglish = getSongLanguage(sourceSong) === 'english'

  for (const candidate of candidates || []) {
    if (queue.length >= limit) break
    if (!candidate || !candidate.id || seenIds.has(String(candidate.id))) continue

    const song = normalizeRecommendationSong(candidate)
    const titleKey = normalizeTitle(song.title)
    if (!titleKey || (titleCounts.get(titleKey) || 0) >= maxPerTitle) continue
    if (lockToEnglish && song.language !== 'english') continue

    const artistKey = getArtistKey(candidate)
    if ((artistCounts.get(artistKey) || 0) >= maxPerArtist) continue

    queue.push(song)
    seenIds.add(String(song.id))
    titleCounts.set(titleKey, (titleCounts.get(titleKey) || 0) + 1)
    artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1)
  }

  return queue
}

export const fetchDiverseRecommendationQueue = async (sourceSong, apiClient, options) => {
  const candidates = await fetchRecommendationCandidates(sourceSong, apiClient)
  return buildDiverseQueue(sourceSong, candidates, options)
}
