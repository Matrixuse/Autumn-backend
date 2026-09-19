import { Pause, Play, Shuffle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SongCard from '../components/cards/SongCard'
import { usePlayer } from '../context/PlayerContext'

export default function RecentlyPlayed() {
  const navigate = useNavigate()
  const { listenHistory, currentTrack, isPlaying, playTrack } = usePlayer()

  const playAll = () => {
    if (listenHistory.length) playTrack(listenHistory[0], listenHistory)
  }

  const shuffleAll = () => {
    if (!listenHistory.length) return
    const shuffled = [...listenHistory].sort(() => Math.random() - 0.5)
    playTrack(shuffled[0], shuffled)
  }

  return (
    <div className="space-y-4 md:space-y-8 text-white">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">Your listening history</p>
          <h1 className="font-['Space_Grotesk'] text-2xl md:text-4xl font-bold">Recently played</h1>
        </div>
      </div>

      {listenHistory.length ? (
        <div className="mb-20">
          <div className="flex items-center gap-3 mb-5">
            <button type="button" onClick={playAll} className="flex items-center gap-2 rounded-full bg-[#eeece8] px-3 py-2 md:px-5 md:py-3 text-sm font-bold text-[#21160a]"><Play size={17} fill="currentColor" />Play all</button>
            <button type="button" onClick={shuffleAll} aria-label="Shuffle recently played songs" className="rounded-full border border-white/10 bg-white/6 p-2 md:p-3"><Shuffle size={18} /></button>
            {currentTrack && isPlaying && <span className="flex items-center gap-2 text-sm text-white/50"><Pause size={15} fill="currentColor" />Now playing</span>}
          </div>
          <div className="scrollbar-none grid grid-cols-2 gap-x-4 gap-y-8 overflow-x-auto pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {listenHistory.map((song) => <SongCard key={song.id} song={song} queue={listenHistory} />)}
          </div>
        </div>
      ) : (
        <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <div>
            <p className="text-lg font-semibold">No recently played songs</p>
            <p className="mt-2 text-sm text-white/45">Play a song and it will appear here.</p>
          </div>
        </div>
      )}
    </div>
  )
}
