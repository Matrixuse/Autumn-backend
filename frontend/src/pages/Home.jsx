import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import MoodChips from '../components/sections/MoodChips'
import ListenAgain from '../components/sections/ListenAgain'
import PopularArtists from '../components/sections/PopularArtists'
import ArtistSpotlight from '../components/sections/ArtistSpotlight'
import QuickPicks from '../components/sections/QuickPicks'
import LongToListen from '../components/sections/LongToListen'
import Footer from '../components/sections/Footer'
import Library from '../components/sections/Library'
import MixForYou from '../components/sections/MixForYou'
import Moods from '../components/sections/Moods'
import Albums from '../components/sections/Albums'
import Hollywood from '../components/sections/Hollywood'
import PastPlays from '../components/sections/PastPlays'
import { useFetchSongs, useFetchQuickPicks, useFetchNewReleases, useFetchLongSongs } from '../hooks/useFetchSongs'
import { useDailyRotationDate } from '../hooks/useDailyRotationDate'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'
import { getBestImageUrl } from '../utils/mediaQuality'
import { getHollywoodSongs, getSongsByIds, searchSongs } from '../api/songs'
import { getMixForYouPlaylists, searchPlaylists } from '../api/playlists'
import { getAlbumsForYou, searchAlbums } from '../api/albums'
import { mapWithConcurrency } from '../api/requestQueue'
import { HOLLYWOOD_CURATED_TRACKS, VERIFIED_CURATED_IDS } from '../config/curatedSongs'
import { getDailyRotationKey, shuffleForDailyRotation } from '../utils/dailyRotation'
import { setItemWithCacheEviction } from '../utils/storage'
import { getSongArtists } from '../utils/songSearch'
import { attachPastPlaysArtwork } from '../utils/pastPlays'
import { fetchPastPlaysSnapshot } from '../api/recommendations'

const getSuggestedLibrarySongs = (fallbackSongs = [], limit = 24, userId = 'anonymous', date = new Date()) => {
  const basePool = Array.isArray(fallbackSongs) ? fallbackSongs.filter(Boolean) : []

  if (!basePool.length) return []

  return shuffleForDailyRotation(basePool, { userId, scope: 'library', date }).slice(0, limit)
}

const getDiscoveryPool = (...songLists) => {
  const songsById = new Map()

  songLists.flat().forEach((song) => {
    if (!song?.id || !song?.audio) return
    songsById.set(String(song.id), song)
  })

  return [...songsById.values()]
}

const fixedArtistNames = [
  'KK',
  'Arijit Singh',
  'Pritam',
  'Shreya Ghoshal',
  'Palak Muchhal',
  'A.R. Rahman',
  'Lata Mangeshkar',
  'Yo Yo Honey Singh',
  'Talwiinder',
  'Sunidhi Chauhan',
  'Mohit Chauhan',
  'Sonu Nigam',
  'Sachin-Jigar',
  'Neha Kakkar',
  'Atif Aslam',
  'Udit Narayan',
  'Vishal-Shekhar',
  'Shubh',
  'Guru Randhawa',
  'Badshah'
]

const homeSectionRequests = new Map()

const getOrCreateHomeSectionRequest = (key, loader) => {
  const activeRequest = homeSectionRequests.get(key)
  if (activeRequest) return activeRequest

  const request = Promise.resolve().then(loader)
  homeSectionRequests.set(key, request)
  return request
}

const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const getDailyArtist = (availableArtists, userId, date) => {
  if (!availableArtists.length) return null

  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000)
  const userOffset = [...String(userId || 'anonymous')].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0)
  return availableArtists[(day + userOffset) % availableArtists.length]
}

const hasCompleteArtistSpotlight = (entries) => Array.isArray(entries)
  && entries.length === 10
  && entries.filter((entry) => entry.kind === 'song').length === 7
  && entries.filter((entry) => entry.kind === 'playlist' || entry.kind === 'album').length === 3

const getArtistSpotlightSongs = (songs, artistName) => {
  const expectedArtist = normalizeName(artistName)
  const uniqueSongs = new Map()

  ;(Array.isArray(songs) ? songs : []).forEach((song) => {
    const songArtist = normalizeName(song?.artist || getSongArtists(song))
    const id = String(song?.id || song?.trackId || '')
    if (!id || !songArtist.includes(expectedArtist) || uniqueSongs.has(id)) return
    uniqueSongs.set(id, song)
  })

  return [...uniqueSongs.values()]
}

const isCompleteArtistSet = (artists) => Array.isArray(artists)
  && artists.length === fixedArtistNames.length
  && artists.every((artist, index) => (
    normalizeName(artist?.name) === normalizeName(fixedArtistNames[index])
    && Boolean(getBestImageUrl(artist?.image))
  ))

const readDailyCache = (key, userId, date) => {
  try {
    const rotationKey = getDailyRotationKey(userId, key, date)
    const cacheKey = `autumn_home_${rotationKey}`
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
    if (Array.isArray(cached)) return null
    return cached?.key === rotationKey && Array.isArray(cached.items) ? cached.items : null
  } catch {
    return null
  }
}

const writeDailyCache = (key, value, userId, date) => {
  const rotationKey = getDailyRotationKey(userId, key, date)
  setItemWithCacheEviction(`autumn_home_${rotationKey}`, JSON.stringify({ key: rotationKey, items: value }))
}

const fetchArtistDetails = async (name) => {
  try {
    const response = await axiosInstance.get('/search/artists', {
      params: { query: name, page: 0, limit: 5 }
    })

    const results = response.data?.data?.results || []
    const match = results.find((artist) => normalizeName(artist?.name) === normalizeName(name))

    if (!match) return { id: name, name, image: null }

    return {
      id: match.id || name,
      name,
      image: getBestImageUrl(match.image || match.images) || null
    }
  } catch {
    return { id: name, name, image: null }
  }
}

export default function Home() {
  const rotationDate = useDailyRotationDate()
  const [artists, setArtists] = useState([])
  const [loadedArtistSpotlight, setLoadedArtistSpotlight] = useState({ key: '', entries: [] })
  const [mixPlaylists, setMixPlaylists] = useState([])
  const [albumsForYou, setAlbumsForYou] = useState([])
  const [curatedHollywoodSongs, setCuratedHollywoodSongs] = useState([])
  const { songs, loading, error } = useFetchSongs()
  const { listenHistory, listenAgain, likedSongs, recommendationEvents, currentTrack } = usePlayer()
  const { user } = useAuth()
  const userId = user?.id || 'anonymous'
  const [pastPlaysSongs, setPastPlaysSongs] = useState([])
  const userCreatedAt = user?.createdAt ? new Date(user.createdAt) : null
  const isPastPlaysEligible = Boolean(userCreatedAt && !Number.isNaN(userCreatedAt.getTime()))
    && Date.now() - userCreatedAt.getTime() >= 20 * 24 * 60 * 60 * 1000
  const shouldShowPastPlays = isPastPlaysEligible && pastPlaysSongs.length > 0
  const { songs: newReleaseSongs, loading: releaseLoading, error: releaseError } = useFetchNewReleases(listenHistory)
  const { songs: longSongs, loading: longLoading, error: longError } = useFetchLongSongs(listenHistory)
  const getCurrentListenHistory = useEffectEvent(() => listenHistory)
  const discoverySongs = useMemo(() => getDiscoveryPool(
    songs,
    newReleaseSongs,
    longSongs,
    listenHistory
  ), [listenHistory, longSongs, newReleaseSongs, songs])
  const librarySongs = useMemo(() => getSuggestedLibrarySongs(discoverySongs, 48, userId, rotationDate), [discoverySongs, rotationDate, userId])
  const moodSongs = useMemo(() => shuffleForDailyRotation(librarySongs, { userId, scope: 'your-moods', date: rotationDate }), [librarySongs, rotationDate, userId])
  const { songs: quickPickSongs, loading: quickLoading, error: quickError } = useFetchQuickPicks({
    history: listenHistory,
    moodSongs,
    likedSongs,
    discoverySongs,
    playbackEvents: recommendationEvents,
    currentTrack,
    userId,
    enabled: !loading && !releaseLoading && !longLoading
  })
  const hollywoodSongs = useMemo(() => {
    const pool = [...curatedHollywoodSongs, ...(songs || []), ...(newReleaseSongs || []), ...(quickPickSongs || [])]
    return getHollywoodSongs(pool, 24)
  }, [curatedHollywoodSongs, songs, newReleaseSongs, quickPickSongs])
  const listenAgainSongs = listenAgain.length ? listenAgain : (listenHistory.length ? listenHistory : librarySongs)
  const spotlightArtist = useMemo(() => {
    const availableArtists = artists.filter((artist) => (
      artist?.id && artist?.name && normalizeName(artist.id) !== normalizeName(artist.name)
    ))
    return getDailyArtist(availableArtists, userId, rotationDate)
  }, [artists, rotationDate, userId])
  const spotlightCacheKey = spotlightArtist ? `artist-spotlight-v2-${spotlightArtist.id}` : ''
  const spotlightEntryKey = spotlightArtist ? `${userId}:${rotationDate}:${spotlightArtist.id}` : ''
  const cachedArtistSpotlight = useMemo(() => (
    spotlightCacheKey && hasCompleteArtistSpotlight(readDailyCache(spotlightCacheKey, userId, rotationDate))
      ? readDailyCache(spotlightCacheKey, userId, rotationDate)
      : []
  ), [rotationDate, spotlightCacheKey, userId])
  const artistSpotlightItems = loadedArtistSpotlight.key === spotlightEntryKey
    ? loadedArtistSpotlight.entries
    : cachedArtistSpotlight
  const spotlightSongs = useMemo(() => artistSpotlightItems
    .filter((entry) => entry.kind === 'song')
    .map((entry) => entry.item), [artistSpotlightItems])

  useEffect(() => {
    if (!spotlightArtist || cachedArtistSpotlight.length) return undefined

    let isMounted = true
    const loadArtistSpotlight = async () => {
      const [songsResult, playlistsResult, albumsResult, searchedAlbumsResult] = await Promise.allSettled([
        axiosInstance.get(`/artists/${encodeURIComponent(String(spotlightArtist.id))}/songs`, {
          params: { page: 0, limit: 50, sortBy: 'popularity', sortOrder: 'desc' }
        }),
        searchPlaylists(`${spotlightArtist.name} playlist`, 20),
        axiosInstance.get(`/artists/${encodeURIComponent(String(spotlightArtist.id))}/albums`, {
          params: { page: 0, limit: 30, sortBy: 'popularity', sortOrder: 'desc' }
        }),
        searchAlbums(`${spotlightArtist.name} album`, 20)
      ])

      let songs = songsResult.status === 'fulfilled'
        ? getArtistSpotlightSongs(songsResult.value?.data?.data?.songs, spotlightArtist.name)
        : []

      if (songs.length < 7) {
        const searchResults = await searchSongs(`${spotlightArtist.name} songs`, 30).catch(() => [])
        songs = getArtistSpotlightSongs([...songs, ...searchResults], spotlightArtist.name)
      }

      const playlists = playlistsResult.status === 'fulfilled'
        ? playlistsResult.value.filter((playlist) => playlist?.image || playlist?.images)
        : []
      const artistAlbums = albumsResult.status === 'fulfilled'
        ? (albumsResult.value?.data?.data?.albums || [])
        : []
      const searchedAlbums = searchedAlbumsResult.status === 'fulfilled' ? searchedAlbumsResult.value : []
      const albums = [...artistAlbums, ...searchedAlbums]
        .map((album) => ({
          ...album,
          id: album.id || album._id,
          name: album.name || album.title,
          description: album.description || album.subtitle || `${spotlightArtist.name} · Album`,
          image: getBestImageUrl(album.image || album.images || album.cover || album.thumbnail),
          type: 'album'
        }))
        .filter((album) => album.id && album.name && album.image)
      const collections = [...playlists.map((item) => ({ kind: 'playlist', item })), ...albums.map((item) => ({ kind: 'album', item }))]
      const uniqueCollections = [...new Map(collections.map((entry) => [`${entry.kind}:${entry.item.id}`, entry])).values()]
      const selectedSongs = shuffleForDailyRotation(songs, {
        userId,
        scope: `artist-spotlight-songs-${spotlightArtist.id}`,
        date: rotationDate
      }).slice(0, 7).map((item) => ({ kind: 'song', item }))
      const selectedCollections = shuffleForDailyRotation(uniqueCollections, {
        userId,
        scope: `artist-spotlight-collections-${spotlightArtist.id}`,
        date: rotationDate
      }).slice(0, 3)
      const mixedItems = shuffleForDailyRotation([...selectedSongs, ...selectedCollections], {
        userId,
        scope: `artist-spotlight-sequence-${spotlightArtist.id}`,
        date: rotationDate
      })

      if (isMounted && hasCompleteArtistSpotlight(mixedItems)) {
        setLoadedArtistSpotlight({ key: spotlightEntryKey, entries: mixedItems })
        if (mixedItems.length) writeDailyCache(spotlightCacheKey, mixedItems, userId, rotationDate)
      }
    }

    loadArtistSpotlight().catch(() => {})

    return () => {
      isMounted = false
    }
  }, [cachedArtistSpotlight, rotationDate, spotlightArtist, spotlightCacheKey, spotlightEntryKey, userId])

  useEffect(() => {
    if (!isPastPlaysEligible || !user?.id) {
      setPastPlaysSongs([])
      return undefined
    }

    let isMounted = true
    fetchPastPlaysSnapshot(listenHistory, recommendationEvents, axiosInstance)
      .then((response) => {
        if (!isMounted) return
        const nextSongs = Array.isArray(response?.data?.data?.songs) ? response.data.data.songs : []
        setPastPlaysSongs(attachPastPlaysArtwork(nextSongs, listenHistory))
      })
      .catch(() => {
        if (isMounted) setPastPlaysSongs([])
      })

    return () => {
      isMounted = false
    }
  }, [isPastPlaysEligible, listenHistory, recommendationEvents, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadArtists = async () => {
      const cached = readDailyCache('artists', userId, rotationDate)
      if (isCompleteArtistSet(cached)) {
        if (isMounted) setArtists(cached)
        return
      }

      const results = await getOrCreateHomeSectionRequest(
        `artists:${userId}:${rotationDate}`,
        () => mapWithConcurrency(fixedArtistNames, fetchArtistDetails, 3)
      )
      if (isCompleteArtistSet(results)) writeDailyCache('artists', results, userId, rotationDate)
      if (isMounted) setArtists(results)
    }

    const loadMixPlaylists = async () => {
      const cached = readDailyCache('mix', userId, rotationDate)
      if (cached?.length) {
        if (isMounted) setMixPlaylists(cached)
        return
      }
      const results = await getOrCreateHomeSectionRequest(
        `mix:${userId}:${rotationDate}`,
        () => getMixForYouPlaylists(getCurrentListenHistory(), 10)
      )
      const shuffled = shuffleForDailyRotation(results, { userId, scope: 'mix-for-you', date: rotationDate })
      writeDailyCache('mix', shuffled, userId, rotationDate)
      if (isMounted) setMixPlaylists(shuffled)
    }

    const loadAlbums = async () => {
      const cached = readDailyCache('albums', userId, rotationDate)
      if (cached?.length) {
        if (isMounted) setAlbumsForYou(cached)
        return
      }
      const results = await getOrCreateHomeSectionRequest(
        `albums:${userId}:${rotationDate}`,
        () => getAlbumsForYou(getCurrentListenHistory(), 10)
      )
      const shuffled = shuffleForDailyRotation(results, { userId, scope: 'albums-for-you', date: rotationDate })
      writeDailyCache('albums', shuffled, userId, rotationDate)
      if (isMounted) setAlbumsForYou(shuffled)
    }

    loadArtists()
    loadMixPlaylists()
    loadAlbums()

    return () => {
      isMounted = false
    }
  }, [rotationDate, userId])

  useEffect(() => {
    let isMounted = true
    const ids = VERIFIED_CURATED_IDS(HOLLYWOOD_CURATED_TRACKS)
    if (!ids.length) return undefined

    getSongsByIds(ids).then((songsById) => {
      if (isMounted) setCuratedHollywoodSongs(songsById)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
        <div className="flex flex-col space-y-5 md:space-y-10">
            <div className="order-0 lg:order-1"><MoodChips /></div>
            <div className="order-1 lg:order-3"><QuickPicks songs={quickPickSongs} homeMobileGrid /></div>
            <div className="order-2 lg:order-2"><ListenAgain songs={listenAgainSongs} /></div>
            <div className="order-3 lg:order-5"><Library songs={librarySongs} /></div>
            <div className="order-4 lg:order-6"><MixForYou playlists={mixPlaylists} /></div>
            {spotlightArtist && hasCompleteArtistSpotlight(artistSpotlightItems) && <div className="order-3 md:order-4 lg:order-3"><ArtistSpotlight artist={spotlightArtist} entries={artistSpotlightItems} songs={spotlightSongs} /></div>}
            <div className="order-5 lg:order-4"><PopularArtists artists={artists} /></div>
            <div className="order-6 lg:order-9"><Albums albums={albumsForYou} /></div>
            <div className="order-7 lg:order-7"><Moods songs={moodSongs} /></div>
            <div className="order-8 lg:order-8"><Hollywood songs={hollywoodSongs} /></div>
            {shouldShowPastPlays && <div className="order-9 lg:order-10"><PastPlays songs={pastPlaysSongs} /></div>}
            <div className="order-10 lg:order-11"><LongToListen songs={longSongs} /></div>
            {error && !loading && <div className="py-4 text-sm text-red-400">Unable to load songs right now.</div>}
            {quickError && !quickLoading && <div className="py-4 text-sm text-red-400">Unable to load quick picks right now.</div>}
            {releaseError && !releaseLoading && <div className="py-4 text-sm text-red-400">Unable to load release picks right now.</div>}
            {longError && !longLoading && <div className="py-4 text-sm text-red-400">Unable to load long-form picks right now.</div>}
        </div>
        <Footer />
    </div>
  )
}