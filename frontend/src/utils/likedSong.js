import { getBestImageUrl } from './mediaQuality.js'

const getText = (value) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (Array.isArray(value)) return value.map(getText).filter(Boolean).join(', ')
  if (value && typeof value === 'object') {
    return getText(value.name ?? value.title ?? value.label ?? value.text)
  }
  return ''
}

const getArtist = (song) => {
  const direct = getText(song.artist) || getText(song.primaryArtists) || getText(song.subtitle)
  if (direct) return direct

  const artists = song.artists?.primary?.length ? song.artists.primary : song.artists?.all
  return Array.isArray(artists)
    ? artists.map((artist) => getText(artist)).filter(Boolean).join(', ')
    : ''
}

export const normalizeLikedSong = (song) => {
  if (!song || typeof song !== 'object' || Array.isArray(song)) return null

  const id = getText(song.id ?? song._id ?? song.musicId ?? song.trackId)
  if (!id) return null

  const duration = Number(song.duration ?? song.more_info?.duration ?? 0)
  return {
    ...song,
    id,
    title: getText(song.title) || getText(song.name) || 'Unknown Track',
    artist: getArtist(song) || 'Unknown Artist',
    image: getBestImageUrl(song.image || song.imageUrl || song.cover || song.artwork || song.thumbnail || song.images || song.img || song.more_info?.image) || null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0
  }
}

export const normalizeLikedSongs = (songs) => {
  const uniqueSongs = new Map()
  for (const song of Array.isArray(songs) ? songs : []) {
    const normalized = normalizeLikedSong(song)
    if (normalized) uniqueSongs.set(normalized.id, normalized)
  }
  return [...uniqueSongs.values()]
}

export const needsLikedSongMetadata = (song) => {
  const normalized = normalizeLikedSong(song)
  return Boolean(normalized && (
    normalized.title === 'Unknown Track'
    || normalized.artist === 'Unknown Artist'
    || !normalized.image
  ))
}

export const mergeLikedSongMetadata = (song, details) => {
  const current = normalizeLikedSong(song)
  if (!current) return null
  const resolved = normalizeLikedSong({ ...details, id: current.id })
  if (!resolved) return current

  return normalizeLikedSong({
    ...details,
    ...current,
    id: current.id,
    title: current.title === 'Unknown Track' ? resolved.title : current.title,
    artist: current.artist === 'Unknown Artist' ? resolved.artist : current.artist,
    image: current.image || resolved.image,
    duration: current.duration || resolved.duration,
    audio: current.audio || resolved.audio
  })
}