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
import { useFetchSongs, useFetchQuickPicks, useFetchNewReleases, useFetchLongSongs } from '../hooks/useFetchSongs'
import { usePlayer } from '../context/PlayerContext'
import axiosInstance from '../api/axiosInstance'
import { getBestImageUrl } from '../utils/mediaQuality'
import { getHollywoodSongs } from '../api/songs'
import { getMixForYouPlaylists } from '../api/playlists'
import { getAlbumsForYou } from '../api/albums'
import { mapWithConcurrency } from '../api/requestQueue'
import Loader from '../components/common/Loader'

const getDailySeed = () => `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`

const shuffleBySeed = (items = []) => {
  const seed = getDailySeed()
  const array = [...items]

  for (let i = array.length - 1; i > 0; i -= 1) {
    const charCode = seed.charCodeAt((i + seed.length) % seed.length)
    const nextIndex = (charCode + i * 17) % (i + 1)
    ;[array[i], array[nextIndex]] = [array[nextIndex], array[i]]
  }

  return array
}

const getSuggestedLibrarySongs = (fallbackSongs = [], limit = 24) => {
  const basePool = Array.isArray(fallbackSongs) ? fallbackSongs.filter(Boolean) : []

  if (!basePool.length) return []

  return shuffleBySeed(basePool).slice(0, limit)
}

const getDiscoveryPool = (...songLists) => {
  const songsById = new Map()

  songLists.flat().forEach((song) => {
    if (!song?.id || !song?.audio || !song?.image) return
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

const readDailyCache = (key) => {
  try {
    const cached = JSON.parse(localStorage.getItem(`autumn_home_${key}`) || 'null')
    if (Array.isArray(cached)) return null
    return cached?.date === getDailySeed() && Array.isArray(cached.items) ? cached.items : null
  } catch {
    return null
  }
}

const writeDailyCache = (key, value) => {
  localStorage.setItem(`autumn_home_${key}`, JSON.stringify({ date: getDailySeed(), items: value }))
}

const fetchArtistDetails = async (name) => {
  try {
    const response = await axiosInstance.get('/search/artists', {
      params: { query: name, page: 0, limit: 5 }
    })

    const results = response.data?.data?.results || []
    const match = results.find((artist) => normalizeName(artist?.name) === normalizeName(name)) || results[0]

    return {
      id: match?.id || name,
      name: match?.name || name,
      image: getBestImageUrl(match?.image) || null
    }
  } catch {
    return { id: name, name, image: null }
  }
}

const playlists = [1, 2, 3, 4].map((id) => ({ id, name: `Collection ${id}`, description: 'A fresh listening set', image: null }))

export default function Home() {
  const [artists, setArtists] = useState([])
  const [mixPlaylists, setMixPlaylists] = useState([])
  const [albumsForYou, setAlbumsForYou] = useState([])
  const { songs, loading, error } = useFetchSongs()
  const { listenHistory, listenAgain } = usePlayer()
  const { songs: quickPickSongs, loading: quickLoading, error: quickError } = useFetchQuickPicks(listenHistory)
  const { songs: newReleaseSongs, loading: releaseLoading, error: releaseError } = useFetchNewReleases(listenHistory)
  const { songs: longSongs, loading: longLoading, error: longError } = useFetchLongSongs(listenHistory)
  const discoverySongs = useMemo(() => getDiscoveryPool(
    quickPickSongs,
    songs,
    newReleaseSongs,
    longSongs
  ), [longSongs, newReleaseSongs, quickPickSongs, songs])
  const librarySongs = useMemo(() => getSuggestedLibrarySongs(discoverySongs, 24), [discoverySongs])
  const hollywoodSongs = useMemo(() => {
    const pool = [...(songs || []), ...(newReleaseSongs || []), ...(quickPickSongs || [])]
    return getHollywoodSongs(pool, 24)
  }, [songs, newReleaseSongs, quickPickSongs])
  const listenAgainSongs = listenAgain.length ? listenAgain : (listenHistory.length ? listenHistory : librarySongs)

  useEffect(() => {
    let isMounted = true

    const loadArtists = async () => {
      const cached = readDailyCache('artists')
      if (cached?.length) {
        setArtists(cached)
        return
      }

      const results = await mapWithConcurrency(fixedArtistNames, fetchArtistDetails, 3)
      const validResults = results.filter((artist) => artist?.image)
      writeDailyCache('artists', validResults)
      if (isMounted) setArtists(validResults)
    }

    const loadMixPlaylists = async () => {
      const cached = readDailyCache('mix')
      if (cached?.length) {
        setMixPlaylists(cached)
        return
      }
      const results = await getMixForYouPlaylists(listenHistory, 10)
      const shuffled = shuffleBySeed(results)
      writeDailyCache('mix', shuffled)
      if (isMounted) setMixPlaylists(shuffled)
    }

    const loadAlbums = async () => {
      const cached = readDailyCache('albums')
      if (cached?.length) {
        setAlbumsForYou(cached)
        return
      }
      const results = await getAlbumsForYou(listenHistory, 10)
      const shuffled = shuffleBySeed(results)
      writeDailyCache('albums', shuffled)
      if (isMounted) setAlbumsForYou(shuffled)
    }

    loadArtists()
    loadMixPlaylists()
    loadAlbums()

    return () => {
      isMounted = false
    }
  }, [listenHistory])

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
            <div className="order-7 lg:order-7"><Moods songs={librarySongs} /></div>
            <div className="order-8 lg:order-8"><Hollywood songs={hollywoodSongs} /></div>
            <div className="order-9 lg:order-10"><LongToListen songs={longSongs} /></div>
            {(loading || quickLoading || releaseLoading || longLoading) && <div className="flex justify-center py-4"><Loader label="Loading more music" /></div>}
            {error && !loading && <div className="py-4 text-sm text-red-400">Unable to load songs right now.</div>}
            {quickError && !quickLoading && <div className="py-4 text-sm text-red-400">Unable to load quick picks right now.</div>}
            {releaseError && !releaseLoading && <div className="py-4 text-sm text-red-400">Unable to load release picks right now.</div>}
            {longError && !longLoading && <div className="py-4 text-sm text-red-400">Unable to load long-form picks right now.</div>}
        </div>
        <Footer />
    </div>
  )
}