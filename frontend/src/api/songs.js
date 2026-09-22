import axiosInstance from './axiosInstance'
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality'

export const LIBRARY_ROTATION_MS = 6 * 60 * 60 * 1000
export const NEW_RELEASE_MAX_DAYS = 15

export const recentGlobalQueries = [
  'latest bollywood songs',
  'new Hindi songs',
  'new Bollywood music',
  'trending Hindi songs',
  'recent Indian songs',
  'latest music 2025',
  '2024 Hindi songs',
  'latest romantic songs',
  'new songs 2025',
  'Bollywood trending songs'
]

const normalizeLanguage = (value) => {
  if (!value) return 'unknown'
  return String(value).trim().toLowerCase()
}

const normalizeText = (value = '') => String(value).trim().toLowerCase()

const canonicalHollywoodArtists = {
  'on my way': 'alan walker',
  'bad guy': 'billie eilish',
  'night changes': 'one direction',
  'as it was': 'harry styles',
  'shape of you': 'ed sheeran',
  'perfect': 'ed sheeran',
  'levitating': 'dua lipa',
  'attention': 'charlie puth',
  'closer': 'the chainsmokers',
  'someone like you': 'adele'
}

const englishArtistHints = [
  'justin bieber', 'charlie puth', 'the chainsmokers', 'sia', 'demi lovato', 'selena gomez', 'ed sheeran',
  'rihanna', 'katy perry', 'halsey', 'jessie j', 'ellie goulding', 'post malone', 'maroon 5', 'zayn',
  'beyonce', 'bruno mars', 'dua lipa', 'adele', 'john legend', 'coldplay', 'one direction', 'shawn mendes',
  'taylor swift', 'ava max', 'imagine dragons', 'lauv', 'jason derulo', 'britney spears', 'meghan trainor',
  'wiz khalifa', 'alan walker', 'the script', 'clean bandit', 'calvin harris', 'sam smith', 'chainsmokers'
]

const englishTitleHints = [
  'attention', 'we don', 'don\'t talk anymore', 'no lie', 'good for you', 'love yourself', 'shape of you',
  'i like it', 'let me love you', 'sorry', 'what makes you beautiful', 'call me maybe', 'on my way',
  'same old love', 'party in the usa', 'bad guy', 'flowers', 'as it was', 'night changes', 'someone like you',
  'starboy', 'payphone', 'cool kids', 'dynamite', 'sugar', 'firework', 'moves like jagger', 'locked away',
  'without me', 'love me like you do', 'closer', 'sugar', 'bad liar', 'all too well', 'high hopes', 'havana'
]

const indianLanguageKeys = ['hindi', 'punjabi', 'bhojpuri', 'gujarati', 'marathi', 'tamil', 'telugu', 'kannada', 'malayalam', 'urdu', 'bengali']
const indianNameHints = ['arijit', 'shreya', 'atif', 'neha', 'sonu', 'khan', 'singh', 'kaif', 'malhar', 'goswami', 'mangeshkar', 'chauhan', 'rashid', 'palak', 'vajpayee']
const indicRegex = /[\u0900-\u09FF\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F]/

const englishWordBlacklist = new Set([
  'the','and','for','with','from','that','this','into','your','have','will','when','what','about','over','song','album','live','love','feel','like','just','good','bad','cold','hard','no','we','you','our','all','out','not','one','two','see','there','here','them','then','they','their','also','into','been','more','most','when','your','again','only','some','make','dont','talk','anymore','without','always','never','world','time','day','night','turn','hard','soft','story'
])

const hasIndicCharacters = (value = '') => indicRegex.test(value)

export const isLikelyHollywoodSong = (song = {}) => {
  if (!song || typeof song !== 'object') return false

  const title = normalizeText(song.title || song.name)
  const artist = normalizeText(song.artist || song.artists?.all?.[0]?.name || song.subtitle || '')
  const language = normalizeText(song.language || song.lang)
  const haystack = `${title} ${artist} ${language}`

  if (!title && !artist) return false

  if (indianLanguageKeys.some((key) => language.includes(key))) return false
  if (indianNameHints.some((hint) => artist.includes(hint) || title.includes(hint))) return false
  if (hasIndicCharacters(title) || hasIndicCharacters(artist)) return false

  const explicitEnglish = language.includes('english') || language.includes('en')
  const artistMatch = englishArtistHints.some((hint) => artist.includes(hint))
  const titleMatch = englishTitleHints.some((hint) => title.includes(hint))

  if (explicitEnglish || artistMatch || titleMatch) return true

  const englishWordMatches = (haystack.match(/\b[a-z]{3,}\b/g) || []).filter((word) => !englishWordBlacklist.has(word))
  if (englishWordMatches.length >= 4 && !hasIndicCharacters(haystack)) return true

  return false
}

const normalizeHollywoodSong = (song = {}) => {
  const artist = song.artist
    || (Array.isArray(song.artists?.all) ? song.artists.all.map((item) => item?.name || item?.title).filter(Boolean).join(', ') : '')
    || (Array.isArray(song.artists?.primary) ? song.artists.primary.map((item) => item?.name || item?.title).filter(Boolean).join(', ') : '')
    || song.subtitle
    || song.primaryArtists
    || 'Unknown Artist'
  const title = song.title || song.name || 'Unknown Track'
  const image = getBestImageUrl(song?.image || song?.cover || song?.thumbnail || song?.artwork || song?.images || song?.img || [])
  const audio = getBestAudioUrl(song?.audio || song?.downloadUrl)

  return {
    ...song,
    id: song.id || `${title}-${artist}`,
    title,
    artist,
    image: typeof image === 'string' ? image : (typeof song.image === 'string' ? song.image : (typeof song.cover === 'string' ? song.cover : null)),
    audio: audio || song.audio || null,
    duration: Number(song.duration || song.duration_ms || song.length || 0),
    language: song.language || song.lang || 'english'
  }
}

export const filterHollywoodSongs = (songs = []) => {
  const ranked = []
  const seen = new Set()

  for (const song of songs || []) {
    if (!song) continue

    const normalized = normalizeHollywoodSong(song)
    if (!isLikelyHollywoodSong(normalized)) continue

    const key = `${normalized.id}-${normalized.title}`
    if (seen.has(key)) continue

    seen.add(key)
    ranked.push(normalized)
  }

  return ranked
}

const hollywoodFallbackTracks = [
  { id: 'hollywood-1', title: 'Attention', artist: 'Charlie Puth', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=400&q=80', duration: 210, language: 'english' },
  { id: 'hollywood-2', title: 'We Don\'t Talk Anymore', artist: 'Charlie Puth', image: 'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=400&q=80', duration: 214, language: 'english' },
  { id: 'hollywood-3', title: 'No Lie', artist: 'Sean Paul', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80', duration: 221, language: 'english' },
  { id: 'hollywood-4', title: 'Let Me Love You', artist: 'DJ Snake', image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=80', duration: 205, language: 'english' },
  { id: 'hollywood-5', title: 'Closer', artist: 'The Chainsmokers', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80', duration: 244, language: 'english' },
  { id: 'hollywood-6', title: 'Someone Like You', artist: 'Adele', image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=400&q=80', duration: 285, language: 'english' },
  { id: 'hollywood-7', title: 'Perfect', artist: 'Ed Sheeran', image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=400&q=80', duration: 263, language: 'english' },
  { id: 'hollywood-8', title: 'As It Was', artist: 'Harry Styles', image: 'https://images.unsplash.com/photo-1499415479124-43c32433a620?auto=format&fit=crop&w=400&q=80', duration: 167, language: 'english' },
  { id: 'hollywood-9', title: 'Flowers', artist: 'Miley Cyrus', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80', duration: 200, language: 'english' },
  { id: 'hollywood-10', title: 'Bad Guy', artist: 'Billie Eilish', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=400&q=80', duration: 194, language: 'english' },
  { id: 'hollywood-11', title: 'Shape of You', artist: 'Ed Sheeran', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80', duration: 234, language: 'english' },
  { id: 'hollywood-12', title: 'Levitating', artist: 'Dua Lipa', image: 'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=400&q=80', duration: 203, language: 'english' },
  { id: 'hollywood-13', title: 'Treat You Better', artist: 'Shawn Mendes', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80', duration: 187, language: 'english' },
  { id: 'hollywood-14', title: 'What Makes You Beautiful', artist: 'One Direction', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80', duration: 197, language: 'english' },
  { id: 'hollywood-15', title: 'Sugar', artist: 'Maroon 5', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80', duration: 235, language: 'english' },
  { id: 'hollywood-16', title: 'Good 4 U', artist: 'Olivia Rodrigo', image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=80', duration: 178, language: 'english' },
  { id: 'hollywood-17', title: 'Night Changes', artist: 'One Direction', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80', duration: 227, language: 'english' },
  { id: 'hollywood-18', title: 'Locked Away', artist: 'R. City', image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=400&q=80', duration: 228, language: 'english' },
  { id: 'hollywood-19', title: 'Havana', artist: 'Camila Cabello', image: 'https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=400&q=80', duration: 217, language: 'english' },
  { id: 'hollywood-20', title: 'Titanium', artist: 'David Guetta', image: 'https://images.unsplash.com/photo-1499415479124-43c32433a620?auto=format&fit=crop&w=400&q=80', duration: 245, language: 'english' },
  { id: 'hollywood-21', title: 'On My Way', artist: 'Alan Walker', image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=400&q=80', duration: 219, language: 'english' },
  { id: 'hollywood-22', title: 'Firework', artist: 'Katy Perry', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80', duration: 227, language: 'english' },
  { id: 'hollywood-23', title: 'Hips Don\'t Lie', artist: 'Shakira', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80', duration: 218, language: 'english' },
  { id: 'hollywood-24', title: 'Can\'t Feel My Face', artist: 'The Weeknd', image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=400&q=80', duration: 213, language: 'english' }
]

export const getHollywoodSongs = (songs = [], limit = 24) => {
  const normalizedPool = (songs || [])
    .map((song) => normalizeHollywoodSong(song))
    .filter((song) => song?.image && song?.title && song?.artist)

  const realSongs = normalizedPool.filter((song) => isLikelyHollywoodSong(song))
  const bestByTitle = new Map()

  for (const song of realSongs) {
    const titleKey = normalizeText(song.title).replace(/[^a-z0-9]+/g, ' ').trim()
    const artistKey = normalizeText(song.artist)
    const canonicalArtist = canonicalHollywoodArtists[titleKey]
    const score = canonicalArtist && artistKey.includes(canonicalArtist) ? 100 : (song.audio ? 10 : 0)
    const current = bestByTitle.get(titleKey)
    if (!current || score > current.score) bestByTitle.set(titleKey, { song, score })
  }

  const dedupedRealSongs = [...bestByTitle.values()].map(({ song }) => song).slice(0, limit)

  const fallback = []
  const fallbackSeen = new Set()

  for (const fallbackSong of hollywoodFallbackTracks) {
    const key = `${fallbackSong.id}-${fallbackSong.title}`
    if (fallbackSeen.has(key)) continue
    fallbackSeen.add(key)
    fallback.push({ ...normalizeHollywoodSong(fallbackSong), artist: fallbackSong.artist || 'Unknown Artist' })
    if (fallback.length >= limit) break
  }

  const remaining = Math.max(0, limit - dedupedRealSongs.length)
  const fallbackSongs = fallback.slice(0, remaining)

  return shuffleBySeed([...dedupedRealSongs, ...fallbackSongs]).slice(0, limit)
}

const getDailyShuffleSeed = () => {
  const today = new Date()
  return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
}

const shuffleBySeed = (items) => {
  const seed = getDailyShuffleSeed()
  const array = [...items]

  for (let i = array.length - 1; i > 0; i -= 1) {
    const charCode = seed.charCodeAt((i + seed.length) % seed.length)
    const nextIndex = (charCode + i * 13) % (i + 1)
    ;[array[i], array[nextIndex]] = [array[nextIndex], array[i]]
  }

  return array
}

const isRecentEnough = (song, maxDays = NEW_RELEASE_MAX_DAYS) => {
  const rawDate = song?.releaseDate || song?.year || null
  const currentYear = new Date().getFullYear()

  if (!rawDate) {
    return true
  }

  const parsedDate = new Date(rawDate)
  if (!Number.isNaN(parsedDate.getTime())) {
    const diffMs = Date.now() - parsedDate.getTime()
    return diffMs >= 0 && diffMs <= maxDays * 24 * 60 * 60 * 1000
  }

  const releaseYear = Number(String(rawDate).slice(0, 4))
  if (Number.isFinite(releaseYear)) {
    return releaseYear >= currentYear - 3
  }

  return true
}

const isWithinThreeYears = (song) => {
  const rawDate = song?.releaseDate || song?.year || null
  if (!rawDate) return false

  const parsedDate = new Date(rawDate)
  if (!Number.isNaN(parsedDate.getTime())) {
    const diffMs = Date.now() - parsedDate.getTime()
    const threeYearsMs = 365 * 24 * 60 * 60 * 1000 * 3
    return diffMs >= 0 && diffMs <= threeYearsMs
  }

  const releaseYear = Number(String(rawDate).slice(0, 4))
  return Number.isFinite(releaseYear) && releaseYear >= new Date().getFullYear() - 3
}

export const getListeningLanguageProfile = (history = []) => {
  const counts = {}

  history.forEach((track) => {
    const language = normalizeLanguage(track?.language || track?.lang)
    if (language && language !== 'unknown') {
      counts[language] = (counts[language] || 0) + 1
    }
  })

  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([language]) => language)
}

export const getNewReleaseSearchQueries = (history = []) => {
  const profile = getListeningLanguageProfile(history)
  const preferred = profile.length ? profile.slice(0, 2) : ['hindi']
  const currentYear = new Date().getFullYear()

  const languageMap = {
    hindi: ['latest Bollywood songs', 'new Hindi songs', 'latest Hindi music', 'new Bollywood music'],
    english: ['latest English songs', 'new English songs', 'top new English music', 'latest English music'],
    bhojpuri: ['latest Bhojpuri songs', 'new Bhojpuri music', 'Bhojpuri latest songs', 'latest Bhojpuri music'],
    punjabi: ['latest Punjabi songs', 'new Punjabi songs', 'Punjabi new music', 'latest Punjabi music'],
    tamil: ['latest Tamil songs', 'new Tamil songs', 'Tamil new music', 'latest Tamil music'],
    telugu: ['latest Telugu songs', 'new Telugu songs', 'Telugu new music', 'latest Telugu music'],
    marathi: ['latest Marathi songs', 'new Marathi songs', 'Marathi new music', 'latest Marathi music'],
    kannada: ['latest Kannada songs', 'new Kannada songs', 'Kannada new music', 'latest Kannada music'],
    gujarati: ['latest Gujarati songs', 'new Gujarati songs', 'Gujarati new music', 'latest Gujarati music']
  }

  const queries = []
  preferred.forEach((language) => {
    const list = languageMap[language] || languageMap.hindi
    queries.push(...list)
  })

  if (!queries.length) {
    queries.push(...languageMap.hindi)
  }

  return [...new Set(queries)]
}

export const getRotatedLibraryQueries = (queries = recentGlobalQueries, rotationMs = LIBRARY_ROTATION_MS) => {
  const rotationIndex = Math.floor(Date.now() / rotationMs)
  const pool = [...queries]
  const offset = rotationIndex % pool.length
  return [...pool.slice(offset), ...pool.slice(0, offset)]
}

export const searchSongs = async (query, limit = 5, page = 0) => {
  const response = await axiosInstance.get('/search/songs', {
    params: { query, page, limit }
  })

  return response.data?.data?.results || []
}

export const searchAll = async (query) => {
  const response = await axiosInstance.get('/search', { params: { query } })
  return response.data?.data || {}
}

const normalizeMoodSong = (song = {}) => ({
  id: song?.id || `${song?.name || song?.title || 'song'}-${Math.random().toString(36).slice(2, 9)}`,
  title: song?.name || song?.title || 'Untitled track',
  artist: (song?.artists?.all || song?.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || song?.subtitle || 'Unknown Artist',
  image: getBestImageUrl(song?.image || song?.cover || song?.artwork || song?.thumbnail),
  audio: getBestAudioUrl(song?.downloadUrl || song?.audio),
  duration: Number(song?.duration || song?.more_info?.duration || 0) || null,
  album: song?.album || song?.more_info?.album || null,
  language: song?.language || song?.lang || 'unknown',
  releaseDate: song?.releaseDate || song?.year || null
})

const getMoodTerms = (mood = '') => [...new Set(
  String(mood)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !['songs', 'song', 'music', 'album', 'mix'].includes(term))
)]

export const getMoodQuickPicksSongs = async (mood, limit = 24) => {
  const safeLimit = Math.max(24, Number(limit) || 24)
  const moodText = String(mood || '').trim()
  if (!moodText) return []

  const terms = getMoodTerms(moodText)
  const queries = [...new Set([
    moodText,
    `${moodText} songs`,
    `${moodText} music`,
    ...terms.map((term) => `${term} songs`)
  ])]

  const batches = await Promise.all(queries.map(async (query) => {
    try {
      return await searchSongs(query, 10)
    } catch {
      return []
    }
  }))

  const candidates = new Map()
  batches.flat().forEach((rawSong) => {
    const song = normalizeMoodSong(rawSong)
    if (!song.audio || !song.image) return

    const key = String(song.id)
    const text = `${song.title} ${song.artist} ${song.album || ''} ${song.language}`.toLowerCase()
    const score = terms.reduce((total, term) => {
      if (song.title.toLowerCase().includes(term)) return total + 8
      if (text.includes(term)) return total + 3
      return total
    }, text.includes(moodText.toLowerCase()) ? 12 : 0)

    const existing = candidates.get(key)
    if (!existing || score > existing.score) candidates.set(key, { song, score })
  })

  const ranked = [...candidates.values()]
    .sort((first, second) => second.score - first.score)
    .map(({ song }) => song)

  const moodSongs = shuffleBySeed(ranked).slice(0, safeLimit)
  if (moodSongs.length >= safeLimit) return moodSongs

  const seen = new Set(moodSongs.map((song) => String(song.id)))
  const fallbackSongs = await getSongs(recentGlobalQueries, safeLimit)
  const backfill = shuffleBySeed(fallbackSongs).filter((song) => {
    const key = String(song?.id)
    if (!song?.audio || !song?.image || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return [...moodSongs, ...backfill].slice(0, safeLimit)
}

export const getSongs = async (queries = recentGlobalQueries, limit = 5) => {
  const targetCount = Math.max(24, Number(limit) || 24)
  const rotatedQueries = getRotatedLibraryQueries(queries)
  const results = await Promise.all(
    rotatedQueries.map(async (query) => {
      try {
        return await searchSongs(query, limit)
      } catch {
        return []
      }
    })
  )

  const normalized = []
  const seen = new Set()

  for (const batch of results) {
    for (const song of batch) {
      const cleaned = {
        id: song?.id || `${song?.name || 'song'}-${Math.random().toString(36).slice(2, 9)}`,
        title: song?.name || song?.title || 'Untitled track',
        artist: (song?.artists?.all || song?.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || song?.subtitle || 'Unknown Artist',
        image: getBestImageUrl(song?.image),
        audio: getBestAudioUrl(song?.downloadUrl),
        duration: Number(song?.duration || 0) || null,
        album: song?.album || null,
        url: song?.url || null,
        releaseDate: song?.releaseDate || null,
        year: song?.year || null,
        language: song?.language || 'hindi'
      }

      if (!cleaned.audio || !cleaned.image) continue
      if (!isWithinThreeYears(cleaned)) continue

      const key = `${cleaned.id}-${cleaned.title}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(cleaned)
      }

      if (normalized.length >= targetCount) break
    }

    if (normalized.length >= targetCount) break
  }

  return normalized.slice(0, targetCount)
}

export const getQuickPicksSongs = async (history = [], limit = 24) => {
  const safeLimit = Math.max(24, Number(limit) || 24)
  const basePool = await getSongs(recentGlobalQueries, 30)

  if (!basePool.length) {
    return []
  }

  if (!history.length) {
    return shuffleBySeed(basePool).slice(0, safeLimit)
  }

  const preferredLanguages = getListeningLanguageProfile(history)
  const preferredArtists = history
    .map((track) => String(track?.artist || track?.artists?.all?.[0]?.name || '').toLowerCase())
    .filter(Boolean)

  const scored = basePool
    .map((song) => {
      const artistText = String(song?.artist || '').toLowerCase()
      const language = normalizeLanguage(song?.language || 'hindi')
      let score = 0

      if (preferredLanguages.includes(language)) score += 35
      if (preferredArtists.some((value) => artistText.includes(value))) score += 40
      if (song?.album) score += 12

      return { song, score }
    })
    .sort((a, b) => b.score - a.score)
    .map(({ song }) => song)

  return shuffleBySeed(scored).slice(0, safeLimit)
}

export const getNewReleaseSongs = async (history = [], limit = 8) => {
  const queries = getNewReleaseSearchQueries(history)
  const rotatedQueries = getRotatedLibraryQueries(queries)
  const results = await Promise.all(
    rotatedQueries.map(async (query) => {
      try {
        return await searchSongs(query, limit)
      } catch {
        return []
      }
    })
  )

  const normalized = []
  const seen = new Set()

  for (const batch of results) {
    for (const song of batch) {
      const cleaned = {
        id: song?.id || `${song?.name || 'song'}-${Math.random().toString(36).slice(2, 9)}`,
        title: song?.name || song?.title || 'Untitled track',
        artist: (song?.artists?.all || song?.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || song?.subtitle || 'Unknown Artist',
        image: getBestImageUrl(song?.image),
        audio: getBestAudioUrl(song?.downloadUrl),
        duration: Number(song?.duration || 0) || null,
        album: song?.album || null,
        url: song?.url || null,
        releaseDate: song?.releaseDate || null,
        year: song?.year || null,
        language: song?.language || 'hindi'
      }

      if (!cleaned.audio || !cleaned.image) continue
      if (!isRecentEnough(cleaned, NEW_RELEASE_MAX_DAYS)) continue

      const key = `${cleaned.id}-${cleaned.title}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(cleaned)
      }

      if (normalized.length >= 8) break
    }

    if (normalized.length >= 8) break
  }

  const deduped = shuffleBySeed([...normalized]).slice(0, 8)

  if (deduped.length >= 4) {
    return deduped
  }

  const fallback = await getSongs(recentGlobalQueries, 5)
  const fallbackResults = shuffleBySeed(
    fallback.filter((song) => isRecentEnough(song, NEW_RELEASE_MAX_DAYS))
  ).slice(0, 8)

  return fallbackResults
}

const getLongSongScore = (song, history = []) => {
  const preferredLanguages = getListeningLanguageProfile(history)
  const preferredArtists = history.map((track) => String(track?.artist || '').toLowerCase()).filter(Boolean)
  const language = normalizeLanguage(song?.language || 'hindi')
  const artistText = String(song?.artist || '').toLowerCase()

  let score = 0

  if (preferredLanguages.includes(language)) score += 25
  if (preferredArtists.some((value) => artistText.includes(value))) score += 20
  if (Number(song?.duration || 0) > 10 * 60) score += 30
  if (song?.album) score += 10

  return score
}

export const getLongToListenSongs = async (history = [], limit = 24) => {
  const targetCount = Math.max(24, Number(limit) || 24)
  const longQueries = [
    'long Hindi songs',
    'epic Bollywood songs',
    'long trending songs',
    'slow long songs',
    'long audio songs',
    'full album songs'
  ]

  const results = await Promise.all(
    longQueries.map(async (query) => {
      try {
        return await searchSongs(query, 12)
      } catch {
        return []
      }
    })
  )

  const normalized = []
  const seen = new Set()

  for (const batch of results) {
    for (const song of batch) {
      const cleaned = {
        id: song?.id || `${song?.name || 'song'}-${Math.random().toString(36).slice(2, 9)}`,
        title: song?.name || song?.title || 'Untitled track',
        artist: (song?.artists?.all || song?.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || song?.subtitle || 'Unknown Artist',
        image: getBestImageUrl(song?.image),
        audio: getBestAudioUrl(song?.downloadUrl),
        duration: Number(song?.duration || 0) || null,
        album: song?.album || null,
        url: song?.url || null,
        releaseDate: song?.releaseDate || null,
        year: song?.year || null,
        language: song?.language || 'hindi'
      }

      if (!cleaned.audio || !cleaned.image) continue
      if (!(Number(cleaned.duration || 0) > 10 * 60)) continue

      const key = `${cleaned.id}-${cleaned.title}`
      if (!seen.has(key)) {
        seen.add(key)
        normalized.push(cleaned)
      }
    }
  }

  const scored = normalized
    .map((song) => ({ song, score: getLongSongScore(song, history) }))
    .sort((a, b) => b.score - a.score)
    .map(({ song }) => song)

  const longPool = shuffleBySeed([...scored])
  const selectedLong = longPool.slice(0, targetCount)

  if (selectedLong.length >= targetCount) {
    return selectedLong
  }

  const fallback = await getSongs(recentGlobalQueries, 80)
  const fallbackPool = shuffleBySeed([
    ...fallback,
    ...selectedLong
  ])

  const merged = []
  const mergedSeen = new Set()

  for (const song of fallbackPool) {
    const key = `${song.id}-${song.title}`
    if (mergedSeen.has(key)) continue
    mergedSeen.add(key)
    merged.push(song)
    if (merged.length >= targetCount) break
  }

  return merged.slice(0, targetCount)
}

export const getSongById = async (id) => {
  const response = await axiosInstance.get(`/songs/${encodeURIComponent(String(id))}`)
  const data = response.data?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

export const getSongsByIds = async (ids = []) => {
  const songs = await Promise.all((ids || []).map(async (id) => {
    try {
      return await getSongById(id)
    } catch {
      return null
    }
  }))
  return songs.filter(Boolean)
}

export const streamUrl = async (id) => {
  const response = await axiosInstance.get(`/songs/${id}`)
  const results = response.data?.data || []
  const song = Array.isArray(results) ? results[0] : null
  return getBestAudioUrl(song?.downloadUrl) || null
}

export { axiosInstance }