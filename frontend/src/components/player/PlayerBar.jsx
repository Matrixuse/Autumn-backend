import { ChevronUp, ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { getBestImageUrl } from '../../utils/mediaQuality'
import { formatTime } from '../../utils/formatTime'
import SongActionsMenu from '../common/SongActionsMenu'

export default function PlayerBar() {
  const { currentTrack, queue, isPlaying, togglePlay, next, previous, progress, duration, seek, volume, setVolume, isShuffleEnabled, isRepeatEnabled, toggleShuffle, toggleRepeat } = usePlayer()
  const navigate = useNavigate()
  const location = useLocation()
  const isKeepListeningOpen = location.pathname === '/keep-listening'
  const [dragOffset, setDragOffset] = useState(0)
  const touchStartRef = useRef(null)
  const swipeConsumedRef = useRef(false)

  const handleTouchStart = (event) => {
    if (window.innerWidth >= 1024) return
    touchStartRef.current = event.touches[0].clientY
    swipeConsumedRef.current = false
  }

  const handleTouchMove = (event) => {
    if (touchStartRef.current === null || window.innerWidth >= 1024) return
    const delta = event.touches[0].clientY - touchStartRef.current
    if (delta < -8) {
      swipeConsumedRef.current = true
      setDragOffset(Math.max(-window.innerHeight * 0.72, delta))
    }
  }

  const handleTouchEnd = (event) => {
    if (touchStartRef.current === null || window.innerWidth >= 1024) return
    const delta = touchStartRef.current - event.changedTouches[0].clientY
    touchStartRef.current = null
    setDragOffset(0)
    if (delta > 64) {
      swipeConsumedRef.current = true
      navigate('/now-playing')
    }
  }

  const toggleKeepListening = () => {
    if (swipeConsumedRef.current) {
      swipeConsumedRef.current = false
      return
    }
    if (window.matchMedia('(max-width: 1023px)').matches) {
      navigate('/now-playing')
      return
    }
    if (isKeepListeningOpen) {
      navigate(-1)
      return
    }

    navigate('/keep-listening')
  }

  if (!currentTrack) return null
  const image = getBestImageUrl(currentTrack.image)
  return (
    <footer
      className="player-bar fixed inset-x-0 bottom-0 z-40 h-17 border-t border-white/10 bg-[#202020] px-4 text-white shadow-2xl sm:px-5 md:h-19.5"
      style={{ transform: `translateY(${dragOffset}px)`, transition: dragOffset === 0 ? 'transform 280ms ease-out' : 'none' }}
    >
      <input aria-label="Track progress" className="absolute left-0 right-0 top-0 h-0.5 w-full cursor-pointer appearance-auto bg-white/20 accent-[#2243ec]" type="range" min="0" max={duration || 1} value={progress} onChange={(event) => seek(event.target.value)} />
      <div className="flex h-full items-center gap-4 sm:gap-6">
        <div className="hidden md:flex shrink-0 items-center gap-5 w-1/6 sm:block">
            <button onClick={previous} aria-label="Previous track" className="text-white hover:text-white/70">
                <SkipBack size={22} fill="currentColor" />
            </button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="text-white hover:text-white/70">
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            </button>
            <button onClick={next} aria-label="Next track" className="text-white hover:text-white/70">
                <SkipForward size={22} fill="currentColor" />
            </button>
            <span className="hidden items-center gap-1 text-xs whitespace-nowrap text-white/55 sm:flex">
                <span>{formatTime(progress)}</span>
                <span>|</span>
                <span>{formatTime(duration)}</span>
            </span>
        </div>
        <button
          onClick={toggleKeepListening}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label={isKeepListeningOpen ? 'Close queue' : 'Open queue'}
          className="lg:ml-3 md:ml-17 flex min-w-0 flex-1 touch-none items-center justify-start gap-4 text-left sm:max-w-155"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden bg-[#343434]">
            {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
                {currentTrack.title}
            </p>
            <p className="truncate text-xs text-white/55">
                {currentTrack.artist}
            </p>
          </div>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-3 text-white/80 md:mr-10 md:gap-5">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={toggleShuffle} aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} className={`hover:text-white ${isShuffleEnabled ? 'text-[#5b7cff]' : ''}`}>
              <Shuffle size={20} />
            </button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="hover:text-white">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
          </div>
          <div className="hidden md:block">
            <SongActionsMenu song={currentTrack} queue={queue} alwaysVisible />
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <input aria-label="Volume" className="w-25 h-1.5 cursor-pointer accent-white" type="range" min="0" max="1" step=".01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </div>
          <button onClick={toggleRepeat} aria-label={isRepeatEnabled ? 'Disable repeat' : 'Enable repeat'} className={`hidden hover:text-white md:block ${isRepeatEnabled ? 'text-[#5b7cff]' : ''}`}>
            <Repeat2 size={20} />
          </button>
          <button onClick={toggleShuffle} aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} className={`hidden hover:text-white md:block ${isShuffleEnabled ? 'text-[#5b7cff]' : ''}`}>
            <Shuffle size={20} />
          </button>
          <button onClick={toggleKeepListening} aria-label={isKeepListeningOpen ? 'Close queue' : 'Open queue'} className="hidden gap-2 hover:text-white md:flex">
            <ListMusic size={20} />
            <ChevronUp size={19} className={`hidden text-white/60 transition-transform sm:block ${isKeepListeningOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </footer>
)}