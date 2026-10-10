import axiosInstance from './axiosInstance'
import { getBestImageUrl } from '../utils/mediaQuality'
import { mapWithConcurrency } from './requestQueue'

export const albumMoodSeeds = [
  { mood: 'romantic', query: 'romantic album' },
  { mood: 'party', query: 'party album' },
  { mood: 'chill', query: 'chill album' },
  { mood: 'sad', query: 'sad album' },
  { mood: 'happy', query: 'happy album' },
  { mood: 'workout', query: 'workout album' },
  { mood: 'night drive', query: 'night drive album' },
  { mood: 'travel', query: 'travel album' },
  { mood: 'rainy', query: 'rainy day album' },
  { mood: 'indie', query: 'indie album' },
  { mood: 'lofi', query: 'lofi album' },
  { mood: 'devotional', query: 'devotional album' },
  { mood: 'fresh', query: 'new album' },
  { mood: 'focus', query: 'focus album' },
  { mood: 'dance', query: 'dance album' },
  { mood: 'retro', query: 'retro album' }
]

const readLanguageProfile = (history = []) => {
  const counts = {}

  history.forEach((track) => {
    const lang = String(track?.language || track?.lang || '').trim().toLowerCase()
    if (lang) counts[lang] = (counts[lang] || 0) + 1
  })

  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([language]) => language)
}

const getDailyMoodOrder = (history = []) => {
  const preferred = readLanguageProfile(history)
  const preferredLanguage = preferred[0] || 'hindi'

  const languageBoost = {
    hindi: ['romantic', 'happy', 'sad', 'party', 'chill'],
    english: ['chill', 'workout', 'night drive', 'happy', 'indie'],
    punjabi: ['party', 'dance', 'happy', 'travel', 'fresh'],
    tamil: ['romantic', 'devotional', 'happy', 'chill', 'travel'],
    telugu: ['romantic', 'happy', 'chill', 'party', 'travel'],
    marathi: ['romantic', 'happy', 'sad', 'travel', 'fresh'],
    bengali: ['romantic', 'happy', 'sad', 'travel', 'fresh'],
    gujarati: ['romantic', 'happy', 'party', 'travel', 'fresh']
  }

  const boostMap = new Map()
  ;(languageBoost[preferredLanguage] || languageBoost.hindi).forEach((mood) => boostMap.set(mood, 2))

  return [...albumMoodSeeds]
    .map((item) => ({
      ...item,
      weight: boostMap.get(item.mood) || 1,
      seed: `${new Date().getFullYear()}-${new Date().getMonth()}-${Math.floor(new Date().getDate() / 2)}-${item.mood}`
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      return a.seed.localeCompare(b.seed)
    })
}

const normalizeAlbum = (album) => {
  const image = getBestImageUrl(album?.image) || getBestImageUrl(album?.images)

  return {
    id: album?.id || album?.title || `${album?.name || 'album'}-${Math.random().toString(36).slice(2, 8)}`,
    name: album?.name || album?.title || 'Album of the day',
    description: album?.description || album?.subtitle || 'A curated album vibe',
    image,
    url: album?.url || album?.perma_url || null,
    type: album?.type || 'album',
    language: album?.language || null,
    year: album?.year || null,
    songCount: Number(album?.songCount || album?.numsongs || 0) || null
  }
}

export const searchAlbums = async (query, limit = 10, { signal } = {}) => {
  const response = await axiosInstance.get('/search/albums', {
    params: { query, page: 0, limit },
    signal
  })

  return (response.data?.data?.results || []).map(normalizeAlbum)
}

export const getReleaseAlbums = async (mood = '', limit = 8) => {
  const queries = [...new Set([
    `${mood} latest albums`,
    `${mood} new albums`,
    'latest Hindi albums',
    'new Bollywood albums'
  ].filter(Boolean))]
  const results = await mapWithConcurrency(queries, async (query) => {
    try {
      return await searchAlbums(query, 8)
    } catch {
      return []
    }
  }, 3)
  const uniqueAlbums = new Map()

  results.flat().forEach((album) => {
    if (album?.image || album?.url) uniqueAlbums.set(`${album.id}-${album.name}`, album)
  })

  return [...uniqueAlbums.values()]
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
}

export const getAlbumsForYou = async (history = [], limit = 10) => {
  const queries = getDailyMoodOrder(history).slice(0, limit).map((item) => item.query)
  const results = await mapWithConcurrency(queries, async (query) => {
      try {
        const items = await searchAlbums(query, 6)
        return items.filter((item) => item.image || item.url)
      } catch {
        return []
      }
    }, 3)

  const selected = []
  const seen = new Set()

  for (const batch of results) {
    for (const album of batch) {
      const key = `${album.id}-${album.name}`
      if (!seen.has(key)) {
        seen.add(key)
        selected.push(album)
      }
      if (selected.length >= limit) break
    }
    if (selected.length >= limit) break
  }

  if (selected.length >= limit) return selected.slice(0, limit)

  const fallbackQueries = ['romantic album', 'party album', 'chill album', 'happy album', 'sad album', 'travel album']
  const fallback = await mapWithConcurrency(fallbackQueries, (query) => searchAlbums(query, 3).catch(() => []), 3)
  const fallbackItems = fallback.flat().filter((item) => item.image || item.url)

  for (const album of fallbackItems) {
    const key = `${album.id}-${album.name}`
    if (!seen.has(key)) {
      seen.add(key)
      selected.push(album)
    }
    if (selected.length >= limit) break
  }

  return selected.slice(0, limit)
}
