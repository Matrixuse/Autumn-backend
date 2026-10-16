import { getBestImageUrl } from './mediaQuality.js'

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isValidSong = (song) => isRecord(song) && Boolean(song.id || song._id || song.name || song.title || getSongImageUrl(song))

const getValidImageUrl = (value) => {
  const imageUrl = getBestImageUrl(value)
  if (!imageUrl) return null

  const url = String(imageUrl).trim()
  if (!/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:image\/|blob:)/i.test(url)) return null

  try {
    const protocol = new URL(url, 'https://autumn.invalid').protocol
    return ['http:', 'https:', 'data:', 'blob:'].includes(protocol) ? url : null
  } catch {
    return null
  }
}

const getFirstValidImageUrl = (candidates) => {
  for (const candidate of candidates) {
    const imageUrl = getValidImageUrl(candidate)
    if (imageUrl) return imageUrl
  }

  return null
}

const getSongImageUrl = (song) => getFirstValidImageUrl([
  song.image,
  song.images,
  song.cover,
  song.coverImage,
  song.artwork,
  song.thumbnail,
  song.img,
  song.raw?.image,
  song.raw?.images,
  song.raw?.cover,
  song.raw?.artwork,
  song.raw?.thumbnail,
])

export const getPlaylistCoverModel = (playlistValue, songsOverride) => {
  const playlist = isRecord(playlistValue) ? playlistValue : {}
  const songsValue = songsOverride === undefined ? playlist.songs : songsOverride
  const songs = Array.isArray(songsValue) ? songsValue.filter(isValidSong) : []
  const customCover = getFirstValidImageUrl([
    playlist.customCoverImage,
    playlist.customCover,
    playlist.coverImage,
    playlist.isLocal && typeof playlist.image === 'string' ? playlist.image : null,
  ])

  if (customCover) return { layout: 'single', images: [customCover], source: 'custom' }

  if (songs.length) {
    const layout = songs.length === 1 ? 'single' : songs.length === 2 ? 'two' : songs.length === 3 ? 'three' : 'four'
    return {
      layout,
      images: songs.slice(0, 4).map(getSongImageUrl),
      source: 'songs',
    }
  }

  const existingCover = getFirstValidImageUrl([
    playlist.image,
    playlist.images,
    playlist.more_info?.images,
    playlist.cover,
    playlist.thumbnail,
  ])

  return {
    layout: 'single',
    images: [existingCover],
    source: existingCover ? 'playlist' : 'empty',
  }
}