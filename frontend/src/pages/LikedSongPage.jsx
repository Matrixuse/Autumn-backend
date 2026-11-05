import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Heart, Play, Search, Shuffle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../utils/formatTime'
import SongActionsMenu from '../components/common/SongActionsMenu'
import NowPlayingOverlay from '../components/common/NowPlayingOverlay'
import SongSortMenu from '../components/common/SongSortMenu'
import { sortSongs } from '../utils/sortSongs'

function LikedSongCover({ song, active }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <span className="cover-container relative h-12 w-12 shrink-0 rounded bg-[#28251f]">
      {song.image && !imageFailed
        ? <img src={song.image} alt="" onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
        : <span className="grid h-full w-full place-items-center text-xs text-white/50">AU</span>}
      {active && <NowPlayingOverlay />}
    </span>
  )
}

export default function LikedSongPage() {
  const navigate = useNavigate()
  const { likedSongs, currentTrack, isPlaying, playTrack } = usePlayer()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCompactHeader, setShowCompactHeader] = useState(false)
  const [sortMode, setSortMode] = useState('ascending')
  const songListRef = useRef(null)

  useEffect(() => {
    let animationFrame = 0

    const updateHeaderVisibility = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const listTop = songListRef.current?.getBoundingClientRect().top
        if (listTop === undefined) return

        setShowCompactHeader((visible) => visible ? listTop <= 104 : listTop <= 72)
      })
    }

    updateHeaderVisibility()
    window.addEventListener('scroll', updateHeaderVisibility, { passive: true })
    window.addEventListener('resize', updateHeaderVisibility)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', updateHeaderVisibility)
      window.removeEventListener('resize', updateHeaderVisibility)
    }
  }, [])

  const filteredSongs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return likedSongs
    return likedSongs.filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(term))
  }, [likedSongs, searchTerm])

  const sortedSongs = useMemo(() => sortSongs(filteredSongs, sortMode), [filteredSongs, sortMode])

  const playAll = () => {
    if (sortedSongs.length) playTrack(sortedSongs[0], sortedSongs)
  }

  const shuffleAll = () => {
    if (!sortedSongs.length) return
    const shuffled = [...sortedSongs].sort(() => Math.random() - 0.5)
    playTrack(shuffled[0], shuffled)
  }

  return (
    <div className="relative flex min-h-[60vh] flex-col gap-3 text-white md:h-[calc(100dvh-190px)] md:min-h-0 md:overflow-hidden md:flex-row lg:h-[calc(100dvh-188px)]">
      <div className="w-full rounded-xl p-2 shadow-xl md:w-[38%] md:shrink-0 md:overflow-hidden md:p-5 lg:w-[34%]">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 hover:bg-white/12"><ArrowLeft size={20} /></button>
          <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label={searchOpen ? 'Close search' : 'Search liked songs'} className="rounded-full bg-white/6 p-2 hover:bg-white/12">{searchOpen ? <X size={20} /> : <Search size={23} />}</button>
        </div>
        {searchOpen && <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search liked songs..." aria-label="Search liked songs" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#dcd5d5] md:hidden" />}
        <div className="mt-3 flex flex-col items-center">
            <img src="/likedsong.png" alt="Liked songs" className="mt-5 aspect-square w-60 h-60 rounded-xl object-cover" />
        </div>
        <div className="min-w-0 flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8e8787]">Favourite collection</p>
            <h1 className="truncate font-['Space_Grotesk'] text-3xl font-bold">Liked music</h1>
            <p className="mt-1 text-sm text-white/45">{likedSongs.length} {likedSongs.length === 1 ? 'Liked Songs' : 'Liked Song'}</p>
        </div>
        <div className="mt-6 flex justify-center items-center gap-3">
          <button type="button" onClick={playAll} disabled={!likedSongs.length} className="flex items-center gap-2 rounded-full bg-[#f5f1f1] px-5 py-3 text-sm font-bold text-[#21160a] disabled:cursor-not-allowed disabled:opacity-40"><Play size={17} fill="currentColor" />Play all</button>
          <button type="button" onClick={shuffleAll} disabled={!likedSongs.length} aria-label="Shuffle liked songs" className="rounded-full border border-white/10 bg-white/6 p-3 disabled:cursor-not-allowed disabled:opacity-40"><Shuffle size={18} /></button>
        </div>
        {searchOpen && <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search liked songs..." aria-label="Search liked songs" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#dcd5d5]  hidden sm:block" />}
      </div>

      <div className={`fixed inset-x-0 top-0 z-110 bg-[#080909]/95 px-4 py-2 shadow-lg backdrop-blur-xl transition-[opacity,transform] duration-300 ease-out md:hidden ${showCompactHeader ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 hover:bg-white/12"><ArrowLeft size={20} /></button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold">Liked music</h1>
          <button type="button" onClick={shuffleAll} disabled={!likedSongs.length} aria-label="Shuffle liked songs" className="rounded-full p-2 hover:bg-white/12 disabled:opacity-40"><Shuffle size={19} /></button>
          <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label={searchOpen ? 'Close search' : 'Search liked songs'} className="rounded-full p-2 hover:bg-white/12">{searchOpen ? <X size={21} /> : <Search size={21} />}</button>
        </div>
        {searchOpen && <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search liked songs..." aria-label="Search liked songs" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#dcd5d5]" />}
      </div>

      <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-hidden">
        <div className="flex shrink-0 justify-start"><SongSortMenu sortMode={sortMode} onSortChange={setSortMode} /></div>
        <div ref={songListRef} className="w-full md:min-h-0 md:min-w-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1 md:custom-scrollbar">
        {likedSongs.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-white/10 bg-white/3 p-8 text-center">
                <div>
                    <Heart className="mx-auto mb-3 text-white" size={34} />
                    <p className="text-lg font-semibold">
                        No liked songs yet
                    </p>
                    <p className="mt-2 text-sm text-white/45">
                        Tap the like button on songs to save it here.
                    </p>
                </div>
            </div>
        ) : sortedSongs.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/45">No liked songs match your search.</p>
        ) : (
          <div className="overflow-hidden rounded md:border border-white/10 md:bg-white/3">
              {sortedSongs.map((song, index) => {
              const active = String(currentTrack?.id) === String(song.id) && isPlaying
              return (
                <article key={song.id} className={`flex items-center gap-3 border-b border-white/6  px-2 md:px-4 py-2 md:py-3 last:border-b-0 ${active ? 'bg-[#c88d3b]/10' : 'hover:bg-white/4'}`}>
                    <span className="w-6 hidden sm:block text-center text-xs text-white/35">{index + 1}</span>
                    <button type="button" onClick={() => playTrack(song, sortedSongs)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <LikedSongCover song={song} active={active} />
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{song.title || 'Untitled track'}</span><span className="block truncate text-xs text-white/45">{song.artist || 'Unknown Artist'}</span></span>
                    </button>
                    <SongActionsMenu song={song} queue={sortedSongs} alwaysVisible />
                    <span className="hidden text-xs text-white/40 sm:block">{formatTime(song.duration)}</span>
                </article>
              )
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
