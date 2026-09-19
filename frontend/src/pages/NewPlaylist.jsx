import { Check, ListMusic, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'

export default function NewPlaylist() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userPlaylists, setUserPlaylists } = usePlayer()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') navigate(-1)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const playlist = {
      id: `local-${Date.now()}`,
      name: trimmedName,
      description: description.trim() || 'Your personal collection',
      image: null,
      songs: location.state?.song ? [location.state.song] : [],
      createdAt: new Date().toISOString(),
      isLocal: true,
    }

    setUserPlaylists((playlists) => [playlist, ...playlists])
    navigate('/library')
  }

  const saveToExistingPlaylist = (playlistId) => {
    const selectedSong = location.state?.song
    if (!selectedSong) return

    setUserPlaylists((playlists) => playlists.map((playlist) => {
      if (String(playlist.id) !== String(playlistId)) return playlist
      const songs = Array.isArray(playlist.songs) ? playlist.songs : []
      if (songs.some((song) => String(song.id) === String(selectedSong.id))) return playlist
      return { ...playlist, songs: [...songs, selectedSong] }
    }))
    navigate('/library')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700/5 p-4 backdrop-blur-xs" onMouseDown={(event) => { if (event.target === event.currentTarget) navigate(-1) }}>
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="new-playlist-title" className="w-full max-w-xl rounded-xl border border-white/15 bg-[#242424] p-5 text-white shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 id="new-playlist-title" className="text-xl font-bold">New playlist</h1>
          <button type="button" onClick={() => navigate(-1)} aria-label="Close new playlist dialog" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          <label className="block text-sm text-white/70">
            <span className="sr-only">Playlist title</span>
            <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Title" className="w-full border-b border-white/20 bg-transparent px-0 py-3 text-base text-white outline-none placeholder:text-white/60 focus:border-[#3ca9ff]" />
          </label>
          <label className="block text-sm text-white/70">
            <span className="sr-only">Playlist description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="w-full border-b border-white/20 bg-transparent px-0 py-3 text-base text-white outline-none placeholder:text-white/60 focus:border-[#3ca9ff]" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">Cancel</button>
          <button type="submit" className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#242424] hover:bg-white/85"><Plus size={17} />Create</button>
        </div>

        {location.state?.song && userPlaylists.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-3 text-sm font-semibold text-white/75">Or save to an existing playlist</p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {userPlaylists.map((playlist) => {
                const alreadyAdded = playlist.songs?.some((song) => String(song.id) === String(location.state.song.id))
                return (
                  <button key={playlist.id} type="button" onClick={() => saveToExistingPlaylist(playlist.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10">
                    <ListMusic size={17} className="text-white/50" />
                    <span className="min-w-0 flex-1 truncate">{playlist.name || 'Untitled playlist'}</span>
                    {alreadyAdded ? <Check size={16} className="text-emerald-400" /> : <Plus size={16} className="text-white/50" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
