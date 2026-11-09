import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import MoodChips from '../components/sections/MoodChips'
import QuickPicks from '../components/sections/QuickPicks'
import Moods from '../components/sections/Moods'
import PopularArtists from '../components/sections/PopularArtists'
import MixForYou from '../components/sections/MixForYou'
import { getMoodQuickPicksSongs } from '../api/songs'
import { searchPlaylists } from '../api/playlists'
import { getBestImageUrl } from '../utils/mediaQuality'
import Loader from '../components/common/Loader'

const moodMap = {
  Relax: 'relaxing',
  Romance: 'romantic',
  'Feel good': 'happy',
  Party: 'party',
  Energise: 'energetic',
  Sad: 'sad',
  Focus: 'focus',
  'Work out': 'workout',
  Sleep: 'sleep'
}

const normalizeArtist = (artist = {}) => ({
  id: artist.id || artist._id || artist.name,
  name: artist.name || artist.title || ' ',
  image: getBestImageUrl(artist.image || artist.images || artist.thumbnail),
})

const getMoodArtists = async (moodQuery, moodSongs = []) => {
  const queries = [`${moodQuery} artists`, `${moodQuery} singers`, `${moodQuery} music artists`]
  const responses = await Promise.all(queries.map(async (query) => {
    try {
      const response = await axiosInstance.get('/search/artists', {
        params: { query, page: 0, limit: 7 },
      })
      return response.data?.data?.results || []
    } catch {
      return []
    }
  }))

  const artists = new Map()
  responses.flat().forEach((artist) => {
    const normalized = normalizeArtist(artist)
    if (normalized.id && normalized.name !== ' ') artists.set(String(normalized.id), normalized)
  })

  moodSongs.forEach((song) => {
    const names = String(song?.artist || '').split(',').map((name) => name.trim()).filter(Boolean)
    names.forEach((name) => {
      if (artists.size >= 7) return
      const id = `mood-${name.toLowerCase()}`
      if (!artists.has(id)) artists.set(id, { id, name, image: song.image || null })
    })
  })

  return [...artists.values()].slice(0, 7)
}

const getMoodPlaylists = async (moodQuery) => {
  const queries = [`${moodQuery} songs playlist`, `${moodQuery} music playlist`, `${moodQuery} playlist`]
  const responses = await Promise.all(queries.map(async (query) => {
    try {
      return await searchPlaylists(query, 7)
    } catch {
      return []
    }
  }))

  const playlists = new Map()
  responses.flat().forEach((playlist) => {
    if (playlist?.image || playlist?.url) playlists.set(`${playlist.id}-${playlist.name}`, playlist)
  })

  return [...playlists.values()].slice(0, 7)
}

export default function MoodChipsPage() {
  const { moodName } = useParams()
  const decodedMood = decodeURIComponent(String(moodName || ''))
  const moodQuery = moodMap[decodedMood] || decodedMood || 'happy'
  const [songs, setSongs] = useState([])
  const [artists, setArtists] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const loadMoodSongs = async () => {
      try {
        setLoading(true)
        setError('')

        const songResults = await getMoodQuickPicksSongs(moodQuery, 24)
        const [artistResults, playlistResults] = await Promise.all([
          getMoodArtists(moodQuery, songResults),
          getMoodPlaylists(moodQuery),
        ])

        if (!controller.signal.aborted) {
          setSongs(songResults)
          setArtists(artistResults)
          setPlaylists(playlistResults)
        }
      } catch {
        if (!controller.signal.aborted) {
          setSongs([])
          setError('Unable to load songs for this mood right now.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadMoodSongs()
    return () => controller.abort()
  }, [moodQuery])

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-8 text-white">
        <Loader label={`Loading ${decodedMood || 'mood'}`} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <MoodChips />

      {loading ? (
        <p className="text-sm text-white/60">Finding {decodedMood.toLowerCase()} quick picks...</p>
      ) : songs.length ? (
        <>
          <QuickPicks songs={songs} limit={24} />
          <Moods songs={songs} title="Your mood" eyebrow={`Songs for ${decodedMood}`} limit={15} />
          {artists.length > 0 && <PopularArtists artists={artists} title="Related artists" eyebrow={`Artists for ${decodedMood}`} limit={7} />}
          {playlists.length > 0 && <MixForYou playlists={playlists} title="Mix for you" eyebrow={`Playlists for ${decodedMood}`} limit={7} />}
        </>
      ) : (
        <p className="text-sm text-white/60">No {decodedMood.toLowerCase()} songs are available right now.</p>
      )}
      <br />
      <br />
      <br />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
