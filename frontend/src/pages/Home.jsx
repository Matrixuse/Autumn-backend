import { useEffect, useMemo, useState } from 'react'
import MoodChips from '../components/sections/MoodChips'
import ListenAgain from '../components/sections/ListenAgain'
import PopularArtists from '../components/sections/PopularArtists'
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
import { getHollywoodSongs, getSongsByIds } from '../api/songs'
import { getMixForYouPlaylists } from '../api/playlists'
import { getAlbumsForYou } from '../api/albums'
import { mapWithConcurrency } from '../api/requestQueue'
import { HOLLYWOOD_CURATED_TRACKS, VERIFIED_CURATED_IDS } from '../config/curatedSongs'
import { getDailyRotationKey, shuffleForDailyRotation } from '../utils/dailyRotation'
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

const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

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
  localStorage.setItem(`autumn_home_${rotationKey}`, JSON.stringify({ key: rotationKey, items: value }))
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

const playlists = [1, 2, 3, 4].map((id) => ({ id, name: `Collection ${id}`, description: 'A fresh listening set', image: null }))

export default function Home() {
  const rotationDate = useDailyRotationDate()
  const [artists, setArtists] = useState([])
  const [mixPlaylists, setMixPlaylists] = useState([])
  const [albumsForYou, setAlbumsForYou] = useState([])
  const [curatedHollywoodSongs, setCuratedHollywoodSongs] = useState([])
  const { songs, loading, error } = useFetchSongs()
  const { listenHistory, listenAgain, likedSongs, recommendationEvents, currentTrack } = usePlayer()
  const { user } = useAuth()
  const userId = user?.id || 'anonymous'
  const [pastPlaysSongs, setPastPlaysSongs] = useState([])
  const userCreatedAt = user?.createdAt ? new Date(user.createdAt) : null
  const isPastPlaysEligible = !userCreatedAt || Number.isNaN(userCreatedAt.getTime())
    ? false
    : Date.now() - userCreatedAt.getTime() >= 20 * 24 * 60 * 60 * 1000
  const { songs: newReleaseSongs, loading: releaseLoading, error: releaseError } = useFetchNewReleases(listenHistory)
  const { songs: longSongs, loading: longLoading, error: longError } = useFetchLongSongs(listenHistory)
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
        setPastPlaysSongs(nextSongs)
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
        setArtists(cached)
        return
      }

      const results = await mapWithConcurrency(fixedArtistNames, fetchArtistDetails, 3)
      if (isCompleteArtistSet(results)) writeDailyCache('artists', results, userId, rotationDate)
      if (isMounted) setArtists(results)
    }

    const loadMixPlaylists = async () => {
      const cached = readDailyCache('mix', userId, rotationDate)
      if (cached?.length) {
        setMixPlaylists(cached)
        return
      }
      const results = await getMixForYouPlaylists(listenHistory, 10)
      const shuffled = shuffleForDailyRotation(results, { userId, scope: 'mix-for-you', date: rotationDate })
      writeDailyCache('mix', shuffled, userId, rotationDate)
      if (isMounted) setMixPlaylists(shuffled)
    }

    const loadAlbums = async () => {
      const cached = readDailyCache('albums', userId, rotationDate)
      if (cached?.length) {
        setAlbumsForYou(cached)
        return
      }
      const results = await getAlbumsForYou(listenHistory, 10)
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
  }, [listenHistory, rotationDate, userId])

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
    <div>
        <div className="flex flex-col space-y-5 md:space-y-10">
          <div className="order-0 lg:order-1"><MoodChips /></div>
            <div className="order-1 lg:order-3"><QuickPicks songs={quickPickSongs} homeMobileGrid /></div>
            <div className="order-2 lg:order-2"><ListenAgain songs={listenAgainSongs} /></div>
            <div className="order-3 lg:order-5"><Library songs={librarySongs} /></div>
            <div className="order-4 lg:order-6"><MixForYou playlists={mixPlaylists} /></div>
            <div className="order-5 lg:order-4"><PopularArtists artists={artists} /></div>
            <div className="order-6 lg:order-9"><Albums albums={albumsForYou} /></div>
            <div className="order-7 lg:order-7"><Moods songs={moodSongs} /></div>
            <div className="order-8 lg:order-8"><Hollywood songs={hollywoodSongs} /></div>
            {isPastPlaysEligible && <div className="order-9 lg:order-10"><PastPlays songs={pastPlaysSongs} /></div>}
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