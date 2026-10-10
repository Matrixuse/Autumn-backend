import { getBestAudioUrl, getBestImageUrl } from './mediaQuality.js'

const normalizeText = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const getArtists = (song = {}) => {
  const artists = [
    ...(Array.isArray(song.artists?.primary) ? song.artists.primary : []),
    ...(Array.isArray(song.artists?.all) ? song.artists.all : [])
  ].map((artist) => artist?.name || artist?.title)
    .filter((artist) => artist && normalizeText(artist) !== 'unknown artist')
  if (artists.length) return [...new Set(artists.map(String))]
  if (Array.isArray(song.artist)) {
    return song.artist.map((artist) => String(artist?.name || artist?.title || artist))
      .filter((artist) => artist && normalizeText(artist) !== 'unknown artist')
  }
  const artist = song.artist || song.primaryArtists || song.subtitle
  return artist && normalizeText(artist) !== 'unknown artist' ? [String(artist)] : []
}

export const normalizeQuickPickSong = (song = {}) => {
  if (!song || typeof song !== 'object') return null
  const audio = getBestAudioUrl(song.audio || song.downloadUrl)
  const title = String(song.title || song.name || '').trim()
  const artists = getArtists(song)
  const id = song.id || song._id || song.musicId || song.trackId || song.providerId || undefined
  if (!audio || !title || (!id && !artists.length)) return null
  return {
    ...song,
    ...(id ? { id: String(id) } : {}),
    title,
    ...(artists.length ? { artist: artists.join(', ') } : {}),
    image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
    audio,
    duration: Number(song.duration || song.more_info?.duration || 0) || null
  }
}

const getMetadataIdentity = (song) => {
  const artists = getArtists(song).map(normalizeText).filter(Boolean).sort()
  const title = normalizeText(song.title || song.name)
  if (!artists.length || !title) return ''
  const album = normalizeText(typeof song.album === 'object' ? song.album?.name : song.album || song.more_info?.album)
  const duration = Number(song.duration || song.more_info?.duration || 0)
  const durationBucket = duration > 0 ? Math.round(duration / 5) * 5 : 'unknown'
  return `metadata:${artists.join('|')}:${title}:${album}:${durationBucket}`
}

export const getQuickPickIdentityKeys = (rawSong) => {
  const song = normalizeQuickPickSong(rawSong)
  if (!song) return []
  const provider = String(song.provider || song.source || 'jiosaavn').trim().toLowerCase()
  const keys = []
  if (song._id) keys.push(`internal:${String(song._id)}`)
  if (song.providerId) keys.push(`provider:${provider}:${String(song.providerId)}`)
  if (song.musicId) keys.push(`provider:${provider}:${String(song.musicId)}`)
  if (song.trackId) keys.push(`provider:${provider}:${String(song.trackId)}`)
  if (song.id) keys.push(`provider:${provider}:${String(song.id)}`)
  const metadataIdentity = getMetadataIdentity(song)
  if (metadataIdentity) keys.push(metadataIdentity)
  return [...new Set(keys)]
}

export const deduplicatePlayableQuickPicks = (songs = [], excludedKeys = new Set()) => {
  const seen = new Set(excludedKeys)
  const unique = []
  for (const rawSong of Array.isArray(songs) ? songs : []) {
    const song = normalizeQuickPickSong(rawSong)
    if (!song) continue
    const identityKeys = getQuickPickIdentityKeys(song)
    if (!identityKeys.length || identityKeys.some((key) => seen.has(key))) continue
    identityKeys.forEach((key) => seen.add(key))
    unique.push(song)
  }
  return unique
}

export const fisherYatesShuffle = (items = [], random = Math.random) => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]]
  }
  return shuffled
}

export const collectAndSelectQuickPicks = async ({
  personalizedSources = [],
  sourceLoaders = [],
  fetchGlobalCandidates = async () => [],
  limit = 24,
  maxGlobalBatches = 4,
  random = Math.random,
  shuffle = fisherYatesShuffle
} = {}) => {
  const target = Math.max(0, Math.floor(Number(limit) || 0))
  if (!target) return []

  const settledSources = await Promise.allSettled([
    ...personalizedSources.map((source) => Promise.resolve(source)),
    ...sourceLoaders.map((loader) => Promise.resolve().then(() => loader()))
  ])
  const personalizedSongs = deduplicatePlayableQuickPicks(
    settledSources.filter((result) => result.status === 'fulfilled').flatMap((result) => (
      Array.isArray(result.value) ? result.value : []
    ))
  )
  let combinedUniqueSongs = [...personalizedSongs]
  let fallbackBatchIndex = 0

  while (combinedUniqueSongs.length < target && fallbackBatchIndex < maxGlobalBatches) {
    const missingCount = target - combinedUniqueSongs.length
    let fallbackBatch = []
    try {
      fallbackBatch = await fetchGlobalCandidates({
        missingCount,
        excludeKeys: new Set(combinedUniqueSongs.flatMap(getQuickPickIdentityKeys)),
        batchIndex: fallbackBatchIndex
      })
    } catch {
      fallbackBatch = []
    }
    fallbackBatchIndex += 1

    const existingKeys = new Set(combinedUniqueSongs.flatMap(getQuickPickIdentityKeys))
    const uniqueFallbackSongs = deduplicatePlayableQuickPicks(fallbackBatch, existingKeys)
    combinedUniqueSongs = [...combinedUniqueSongs, ...uniqueFallbackSongs.slice(0, missingCount)]
  }

  combinedUniqueSongs = deduplicatePlayableQuickPicks(combinedUniqueSongs)
  const shuffledOnce = shuffle(combinedUniqueSongs, random)
  const shuffledTwice = shuffle(shuffledOnce, random)
  return shuffledTwice.slice(0, target)
}
