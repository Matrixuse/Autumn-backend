import { apiClient } from './client'

const getMediaUrl = (value, preferredQuality) => {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  const usable = value.filter((item) => typeof item?.url === 'string' && item.url)
  if (!usable.length) return ''
  const preferred = usable.find((item) => String(item.quality || '').toLowerCase().includes(preferredQuality))
  return (preferred || usable[usable.length - 1]).url
}

export const normalizeSong = (song = {}) => {
  const artists = song.artists?.primary || song.artists?.all || []
  return {
    ...song,
    id: String(song.id || song.name || song.title || ''),
    title: song.name || song.title || 'Untitled track',
    artist: artists.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || song.subtitle || song.artist || 'Unknown Artist',
    image: getMediaUrl(song.image || song.images, '500') || song.image || '',
    audio: getMediaUrl(song.downloadUrl || song.audio, '160') || '',
    duration: Number(song.duration || song.more_info?.duration || 0),
    language: song.language || song.lang || song.more_info?.language || 'unknown',
  }
}

const normalizeCollection = (item = {}, type) => ({
  ...item,
  id: String(item.id || item.name || item.title || ''),
  name: item.name || item.title || (type === 'artist' ? 'Unknown artist' : 'Untitled'),
  image: getMediaUrl(item.image || item.images, '500') || item.image || '',
  type,
  description: item.description || item.subtitle || '',
  songCount: Number(item.songCount || item.numsongs || 0),
})

const searchType = async (type, query, limit) => {
  const response = await apiClient.get(`/search/${type}`, {
    params: { query, page: 0, limit },
  })
  return response.data?.data?.results || []
}

export const searchSongs = async (query, limit = 24, page = 0) => {
  const response = await apiClient.get('/search/songs', {
    params: { query, page, limit },
  })
  return (response.data?.data?.results || []).map(normalizeSong)
}

export const searchArtists = async (query, limit = 10) =>
  (await searchType('artists', query, limit)).map((item) => normalizeCollection(item, 'artist'))

export const searchAlbums = async (query, limit = 10) =>
  (await searchType('albums', query, limit)).map((item) => normalizeCollection(item, 'album'))

export const searchPlaylists = async (query, limit = 10) =>
  (await searchType('playlists', query, limit)).map((item) => normalizeCollection(item, 'playlist'))

export const getCollectionSongs = async (type, id) => {
  const response = type === 'artist'
    ? await apiClient.get(`/artists/${encodeURIComponent(id)}/songs`, { params: { page: 0, limit: 100, sortBy: 'popularity', sortOrder: 'desc' } })
    : await apiClient.get(`/${type === 'album' ? 'albums' : 'playlists'}`, { params: { id, limit: 1000 } })
  const payload = response.data?.data
  const songs = Array.isArray(payload) ? payload : payload?.songs || payload?.results || payload?.data || []
  return songs.map(normalizeSong).filter((song) => song.id && song.audio)
}

const uniqueById = (items) => [...new Map(items.filter((item) => item?.id).map((item) => [String(item.id), item])).values()]

export const getHomeFeed = async (history = []) => {
  const favoriteArtist = String(history[0]?.artist || '').split(',')[0].trim()
  const songQueries = [
    favoriteArtist ? `${favoriteArtist} songs` : 'latest Hindi songs',
    'trending Bollywood songs',
    'latest Hindi songs',
    'popular Indian songs',
  ]
  const [songBatches, artistBatch, albumBatches, playlistBatches] = await Promise.all([
    Promise.all(songQueries.map((query) => searchSongs(query, 18).catch(() => []))),
    searchArtists('popular Indian singers', 12).catch(() => []),
    Promise.all(['latest Hindi albums', 'popular Bollywood albums'].map((query) => searchAlbums(query, 8).catch(() => []))),
    Promise.all(['romantic songs playlist', 'chill songs playlist'].map((query) => searchPlaylists(query, 8).catch(() => []))),
  ])

  const songs = uniqueById(songBatches.flat().filter((song) => song.audio && song.image))
  return {
    quickPicks: songs.slice(0, 24),
    library: [...songs].reverse().slice(0, 24),
    newReleases: songs.slice(8, 20),
    longSongs: songs.filter((song) => song.duration >= 240).slice(0, 18),
    artists: uniqueById(artistBatch).slice(0, 12),
    albums: uniqueById(albumBatches.flat()).slice(0, 12),
    playlists: uniqueById(playlistBatches.flat()).slice(0, 12),
  }
}

export const getMoodSongs = async (mood) => searchSongs(`${mood} songs`, 30)