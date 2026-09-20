import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, MoreHorizontal, Play } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { getBestImageUrl } from '../utils/mediaQuality'
import SongCard from '../components/cards/SongCard'
import Loader from '../components/common/Loader'

const normalizeSong = (song = {}) => ({
  id: song.id || song._id || `${song.name || song.title || 'song'}-${Math.random().toString(36).slice(2, 8)}`,
  title: song.name || song.title || 'Unknown Track',
  artist: Array.isArray(song.artists?.all)
    ? song.artists.all.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
    : Array.isArray(song.artists?.primary)
      ? song.artists.primary.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
      : song.artist || song.subtitle || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  raw: song,
})

export default function PlaylistDetail() {
  const navigate = useNavigate()
  const { playlistId, playlistName } = useParams()
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const loadPlaylist = async () => {
      try {
        setLoading(true)
        setError('')

        if (!playlistId) {
          setPlaylist(null)
          setError('Playlist not found.')
          return
        }

        const response = await axiosInstance.get('/playlists', {
          params: { id: playlistId },
          signal: controller.signal,
        })

        const playlistData = response.data?.data
        if (controller.signal.aborted) return

        setPlaylist(playlistData || null)
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load this playlist right now.')
          setPlaylist(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadPlaylist()
    return () => controller.abort()
  }, [playlistId])

  const songs = useMemo(() => {
    if (!playlist?.songs) return []
    return playlist.songs.map(normalizeSong)
  }, [playlist])

  const displayName = playlist?.name || decodeURIComponent(String(playlistName || '')) || 'Playlist'
  const coverImage = playlist?.image?.[0]?.url || playlist?.image?.[0]?.link || songs[0]?.image || null

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-8 text-white">
        <Loader label="Loading playlist" />
      </div>
    )
  }

  if (error || !playlist) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-white">
        <div className="max-w-md rounded-2xl border border-gray-700 bg-[#0f0f0f]/80 p-8 shadow-xl">
          <p className="text-lg font-semibold">No playlist available</p>
          <p className="mt-2 text-sm text-gray-400">{error || 'This playlist could not be loaded.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white" aria-label="Go back">
        <ArrowLeft size={17} />
        Back
      </button>
      <section className="flex flex-col gap-6 rounded-3xl border border-white/8 bg-white/4 p-6 sm:flex-row sm:items-end sm:p-10">
        <div className="grid aspect-square w-40 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-2xl">
          {coverImage ? (
            <img src={coverImage} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[#2b2b2b]">
              <Play size={36} fill="white" />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
            Playlist
          </p>
          <h1 className="mt-2 font-['Space_Grotesk'] text-4xl font-bold">
            {displayName}
          </h1>
          <p className="mt-3 text-sm text-white/45">
            {playlist.description || 'Curated songs for your listening mood.'}
          </p>
          <button className="mt-6 rounded-full bg-[#e6a44a] px-5 py-2.5 text-sm font-bold text-[#21160a]">
            Play all
          </button>
        </div>
        <MoreHorizontal className="ml-auto self-start text-white/50" />
      </section>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} queue={songs} />
        ))}
      </div>
    </div>
  )
}