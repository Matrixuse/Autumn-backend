const noiseTitlePattern = /\b(slowed|sped up|nightcore|reverb|extended|remix|8d|lofi|cover|tribute|instrumental|karaoke|mashup|bass boosted)\b/i

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const getSongTitle = (song) => song?.name || song?.title || ''

const getPlayCount = (item) => Math.max(0, Number(item?.playCount ?? item?.play_count ?? 0) || 0)

export const getSongArtists = (song) => {
  const artists = [song?.artists?.primary, song?.artists?.all, song?.artists?.featured].find((items) => Array.isArray(items) && items.length)
  if (Array.isArray(artists)) return artists.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
  return song?.artist || song?.subtitle || ''
}

const getTitleScore = (songTitle, queryTitle) => {
  if (!songTitle || !queryTitle) return 0
  if (songTitle === queryTitle) return 1000
  if (songTitle.includes(queryTitle) || queryTitle.includes(songTitle)) return 500
  const queryWords = queryTitle.split(' ').filter(Boolean)
  const matchedWords = queryWords.filter((word) => songTitle.includes(word)).length
  return queryWords.length ? (matchedWords / queryWords.length) * 250 : 0
}

const getPlayCountScore = (playCount, maxPlayCount) => {
  const value = Math.max(0, Number(playCount) || 0)
  const max = Math.max(1, Number(maxPlayCount) || 1)
  return (Math.min(value, max) / max) * 25
}

const getArtistScore = (song, expectedArtist) => {
  const expected = normalizeText(expectedArtist)
  if (!expected) return 0

  const artists = getSongArtists(song).split(',').map(normalizeText)
  return artists.some((artist) => artist === expected || artist.includes(expected) || expected.includes(artist)) ? 400 : 0
}

export const scoreSongMatch = (song, { title = '', expectedArtist = '', maxPlayCount = 1 } = {}) => {
  const normalizedTitle = normalizeText(getSongTitle(song))
  const normalizedQuery = normalizeText(title)
  return getTitleScore(normalizedTitle, normalizedQuery)
    + getArtistScore(song, expectedArtist)
    + getPlayCountScore(song?.playCount, maxPlayCount)
}

export const rankSongResults = (results = [], options = {}) => {
  const validResults = Array.isArray(results) ? results.filter(Boolean) : []
  const clean = validResults.filter((song) => !noiseTitlePattern.test(getSongTitle(song)))
  const candidates = clean.length ? clean : validResults
  const maxPlayCount = Math.max(...candidates.map((song) => Number(song?.playCount) || 0), 1)

  return candidates
    .map((song, index) => ({
      song,
      score: scoreSongMatch(song, { ...options, maxPlayCount }),
      index
    }))
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({ song }) => song)
}

export const rankByPlayCount = (results = [], limit) => {
  const ranked = (Array.isArray(results) ? results : [])
    .filter(Boolean)
    .map((item, index) => ({ item, index }))
    .sort((first, second) => getPlayCount(second.item) - getPlayCount(first.item) || first.index - second.index)
    .map(({ item }) => item)

  return Number.isFinite(limit) ? ranked.slice(0, limit) : ranked
}

export const getBestSongMatch = (results = [], options = {}) => rankSongResults(results, options)[0] || null

export const getBestMatch = (topQueryResults = [], songResults = [], options = {}) => {
  const topResult = Array.isArray(topQueryResults) ? topQueryResults[0] : null
  const topIsSong = String(topResult?.type || '').toLowerCase() === 'song'
  const topIsClean = topIsSong && !noiseTitlePattern.test(getSongTitle(topResult))

  if (topIsClean) return topResult

  return getBestSongMatch(songResults, options)
}

export const getSongNoisePattern = () => noiseTitlePattern
