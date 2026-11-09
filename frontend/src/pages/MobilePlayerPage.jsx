import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ThumbsUp, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useUpNextQueue } from '../hooks/useUpNextQueue'
import { useLyrics } from '../hooks/useLyrics'
import { getBestImageUrl } from '../utils/mediaQuality'
import { formatTime } from '../utils/formatTime'
import SongActionsMenu from '../components/common/SongActionsMenu'
import { searchPlaylists } from '../api/playlists'
import ArtistCard from '../components/cards/ArtistCard'
import PlaylistCard from '../components/cards/PlaylistCard'
import SongCard from '../components/cards/SongCard'
import Albums from '../components/sections/Albums'
import { getSongArtists } from '../utils/songSearch'
import NowPlayingOverlay from '../components/common/NowPlayingOverlay'
import SortableQueueList from '../components/player/SortableQueueList'
import MoodChips from '../components/sections/MoodChips'
import Loader from '../components/common/Loader'
import useRelatedTrackDetails from '../hooks/useRelatedTrackDetails'

const tabs = ['UP NEXT', 'LYRICS', 'RELATED']
const dailyDetailsBackgroundColors = [
  '#030202',
  '#1d0c16',
  '#140c1d',
  '#0c151d',
  '#0c1d14',
  '#232516',
  '#1d0c0c',
]

export default function MobilePlayerPage() {
  const navigate = useNavigate()
  const {
    currentTrack,
    isQueueLoading,
    listenHistory,
    listenAgain,
    likedSongs,
    isPlaying,
    progress,
    duration,
    isShuffleEnabled,
    isRepeatEnabled,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    toggleRepeat,
    isLiked,
    toggleLike
  } = usePlayer()
  const { queue, currentIndex, playQueuedTrack, reorderQueue } = useUpNextQueue()
  const [activeTab, setActiveTab] = useState('UP NEXT')
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsDragOffset, setDetailsDragOffset] = useState(0)
  const [detailsBackgroundColor, setDetailsBackgroundColor] = useState(dailyDetailsBackgroundColors[0])
  const [recommendedPlaylists, setRecommendedPlaylists] = useState([])
  const {
    artists: similarArtists,
    albums: relatedAlbums,
    artistsLoading,
    albumsLoading
  } = useRelatedTrackDetails(currentTrack)
  const gestureStartRef = useRef(null)
  const artworkSwipeStartRef = useRef(null)
  const artworkSwipeTimerRef = useRef(null)
  const tabSwipeStartRef = useRef(null)
  const tabContentRef = useRef(null)
  const previousTabRef = useRef(activeTab)
  const [playerDragOffset, setPlayerDragOffset] = useState(0)
  const [artworkSwipeOffset, setArtworkSwipeOffset] = useState(0)
  const [isArtworkSwipeAnimating, setIsArtworkSwipeAnimating] = useState(false)

  const image = getBestImageUrl(currentTrack?.image)
  const currentTitle = currentTrack?.title || currentTrack?.name || 'Unknown Track'
  const currentArtist = getSongArtists(currentTrack)
  const nextTracks = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue
  const { lyrics, copyright: lyricsCopyright, loading: lyricsLoading } = useLyrics(currentTrack, activeTab === 'LYRICS')

  useEffect(() => {
    const content = tabContentRef.current
    const previousIndex = tabs.indexOf(previousTabRef.current)
    const currentIndex = tabs.indexOf(activeTab)
    previousTabRef.current = activeTab

    if (!content || previousIndex === currentIndex || typeof content.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const animation = content.animate([
      { opacity: 0.72, transform: `translateX(${currentIndex > previousIndex ? '18px' : '-18px'})` },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })

    return () => animation.cancel()
  }, [activeTab])

  useEffect(() => {
    let midnightTimer

    const updateDailyBackground = () => {
      const now = new Date()
      const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
      const firstDayOfYear = Date.UTC(now.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((currentDay - firstDayOfYear) / 86400000)
      const colorIndex = dayOfYear % dailyDetailsBackgroundColors.length
      setDetailsBackgroundColor(dailyDetailsBackgroundColors[colorIndex])

      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      midnightTimer = window.setTimeout(updateDailyBackground, nextMidnight.getTime() - now.getTime())
    }

    updateDailyBackground()
    return () => window.clearTimeout(midnightTimer)
  }, [])

  useEffect(() => () => window.clearTimeout(artworkSwipeTimerRef.current), [])

  const recommendedTracks = useMemo(() => {
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const titleKey = (track) => normalize(track?.title || track?.name)
    const artistKey = (track) => normalize(track?.artist || track?.subtitle)
    const currentArtist = artistKey(currentTrack)
    const listenAgainIds = new Set((listenAgain || []).map((track) => String(track?.id)))
    const likedIds = new Set((likedSongs || []).map((track) => String(track?.id)))
    const historyIds = new Set((listenHistory || []).map((track) => String(track?.id)))
    const currentId = String(currentTrack?.id)
    const candidates = [...(likedSongs || []), ...(listenHistory || []), ...nextTracks]
    const scored = candidates
      .filter((track) => track?.id && String(track.id) !== currentId && !listenAgainIds.has(String(track.id)))
      .map((track, index) => {
        const trackArtist = artistKey(track)
        let score = 0
        if (likedIds.has(String(track.id))) score += 1000
        if (historyIds.has(String(track.id))) score += 300
        if (trackArtist && currentArtist && trackArtist.includes(currentArtist.split(' ')[0])) score += 180
        if (nextTracks.some((item) => String(item.id) === String(track.id))) score += 120
        score -= index
        return { track, score }
      })
      .sort((first, second) => second.score - first.score)

    const seenTitles = new Set()
    const seenIds = new Set()
    return scored.filter(({ track }) => {
      const id = String(track.id)
      const title = titleKey(track)
      if (!title || seenIds.has(id) || seenTitles.has(title)) return false
      seenIds.add(id)
      seenTitles.add(title)
      return true
    }).map(({ track }) => track).slice(0, 24)
  }, [currentTrack, likedSongs, listenAgain, listenHistory, nextTracks])

  const relatedTracks = useMemo(() => {
    const seenTitles = new Set()
    return nextTracks.filter((track) => {
      const title = String(track?.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (!title || seenTitles.has(title)) return false
      seenTitles.add(title)
      return true
    }).slice(0, 24)
  }, [nextTracks])

  useEffect(() => {
    if (!currentTrack?.id) {
      setRecommendedPlaylists([])
      return undefined
    }

    const controller = new AbortController()
    const artistName = String(currentTrack.artist || currentTrack.subtitle || '').split(',')[0].trim()
    const playlistQuery = `${currentTrack.title || ''} ${artistName} playlist`.trim()

    const loadRelatedSections = async () => {
      const [playlistResult] = await Promise.allSettled([searchPlaylists(playlistQuery, 8, 0)])

      if (controller.signal.aborted) return

      const playlists = playlistResult.status === 'fulfilled' ? playlistResult.value : []

      setRecommendedPlaylists(playlists.filter((playlist, index, items) => items.findIndex((item) => String(item.id) === String(playlist.id)) === index).slice(0, 8))
    }

    loadRelatedSections()
    return () => controller.abort()
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.subtitle])

  const minimizePlayer = () => {
    navigate(-1)
  }

  const handlePlayerTouchStart = (event) => {
    if (isDetailsOpen) return
    gestureStartRef.current = event.touches[0].clientY
  }

  const handlePlayerTouchMove = (event) => {
    if (gestureStartRef.current === null) return
    const delta = event.touches[0].clientY - gestureStartRef.current
    if (delta > 0) setPlayerDragOffset(Math.min(window.innerHeight * 0.7, delta))
  }

  const handlePlayerTouchEnd = (event) => {
    if (gestureStartRef.current === null) return
    const delta = event.changedTouches[0].clientY - gestureStartRef.current
    gestureStartRef.current = null
    setPlayerDragOffset(0)
    if (delta > 64) minimizePlayer()
  }

  const handleArtworkTouchStart = (event) => {
    if (event.touches.length !== 1) {
      artworkSwipeStartRef.current = null
      return
    }

    event.stopPropagation()
    window.clearTimeout(artworkSwipeTimerRef.current)
    setArtworkSwipeOffset(0)
    setIsArtworkSwipeAnimating(false)
    const touch = event.touches[0]
    artworkSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleArtworkTouchMove = (event) => {
    const start = artworkSwipeStartRef.current
    if (!start) return

    event.stopPropagation()
    const touch = event.touches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setArtworkSwipeOffset(Math.max(-140, Math.min(140, deltaX)))
    } else {
      setArtworkSwipeOffset(0)
    }
  }

  const handleArtworkTouchEnd = (event) => {
    const start = artworkSwipeStartRef.current
    artworkSwipeStartRef.current = null
    event.stopPropagation()
    if (!start || !event.changedTouches.length) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) {
      setIsArtworkSwipeAnimating(true)
      setArtworkSwipeOffset(0)
      artworkSwipeTimerRef.current = window.setTimeout(() => setIsArtworkSwipeAnimating(false), 180)
      return
    }

    event.preventDefault()
    setIsArtworkSwipeAnimating(true)
    setArtworkSwipeOffset(deltaX < 0 ? -window.innerWidth : window.innerWidth)
    artworkSwipeTimerRef.current = window.setTimeout(() => {
      if (deltaX < 0) next()
      else previous()
      setArtworkSwipeOffset(0)
      setIsArtworkSwipeAnimating(false)
    }, 180)
  }

  const handleSheetTouchStart = (event) => {
    gestureStartRef.current = event.touches[0].clientY
  }

  const handleSheetTouchMove = (event) => {
    if (gestureStartRef.current === null) return
    const delta = event.touches[0].clientY - gestureStartRef.current
    if (delta > 0) setDetailsDragOffset(Math.min(window.innerHeight, delta))
  }

  const handleSheetTouchEnd = (event) => {
    if (gestureStartRef.current === null) return
    const delta = event.changedTouches[0].clientY - gestureStartRef.current
    gestureStartRef.current = null
    if (delta > 64) setIsDetailsOpen(false)
    setDetailsDragOffset(0)
  }

  const handleTabContentTouchStart = (event) => {
    if (event.touches.length !== 1) {
      tabSwipeStartRef.current = null
      return
    }

    const target = event.target instanceof Element ? event.target : null
    if (!target || target.closest('input, [data-no-tab-swipe]')) {
      tabSwipeStartRef.current = null
      return
    }

    let element = target
    while (element && element !== event.currentTarget) {
      const style = window.getComputedStyle(element)
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && element.scrollWidth > element.clientWidth) {
        tabSwipeStartRef.current = null
        return
      }
      element = element.parentElement
    }

    const touch = event.touches[0]
    tabSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTabContentTouchEnd = (event) => {
    const start = tabSwipeStartRef.current
    tabSwipeStartRef.current = null
    if (!start || !event.changedTouches.length) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return

    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1)
    if (nextIndex >= 0 && nextIndex < tabs.length) {
      event.preventDefault()
      setActiveTab(tabs[nextIndex])
    }
  }

  const renderPanelContent = () => {
    if (activeTab === 'LYRICS') {
      return lyricsLoading
        ? <div className="px-5 py-6 text-sm text-white/55">Loading lyrics...</div>
        : <div className="px-5 py-6">
          <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">{lyrics || 'Lyrics are not available for this song.'}</p>
          {lyrics && lyricsCopyright && <p className="mt-5 text-xs leading-5 text-white/40">{lyricsCopyright}</p>}
        </div>
    }

    if (activeTab === 'RELATED') {
      return (
        <div className="px-5 py-3">
          <section>
            {relatedTracks.length ? <>
              <div className="mb-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Quick picks</p>
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">For you</h2>
              </div>
              <div className="scrollbar-none grid auto-cols-80 grid-flow-col grid-rows-4 gap-x-2 gap-y-1 overflow-x-auto pb-3">
                {relatedTracks.map((track, index) => (
                  <div key={track.id || `${track.title}-${index}`} role="button" tabIndex={0} onClick={() => playTrack(track, relatedTracks)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); playTrack(track, relatedTracks) } }} className="group flex h-16 min-w-0 items-center gap-3 rounded-lg bg-black/5 px-2 text-left transition hover:bg-white/10">
                    <div className="cover-container h-12 w-12 shrink-0 rounded bg-white/10">
                      {getBestImageUrl(track.image) ? <img src={getBestImageUrl(track.image)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
                      {isPlaying && String(currentTrack?.id) === String(track?.id) && <NowPlayingOverlay />}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{track.title}</span>
                      <span className="mt-1 block truncate text-xs text-white/45">{track.artist}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/45">{formatTime(track.duration)}</span>
                    <span onClick={(event) => event.stopPropagation()}><SongActionsMenu song={track} queue={relatedTracks} mobileAlwaysVisible /></span>
                  </div>
                ))}
              </div>
            </> : <p className="py-4 text-center text-sm text-white/45">No related songs available.</p>}
            {recommendedTracks.length > 0 && (
              <section className="mt-8">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Your moods</p>
                <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Moods for you</h2>
                <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                  {recommendedTracks.slice(0, 8).map((track) => <SongCard key={track.id} song={track} queue={recommendedTracks} />)}
                </div>
              </section>
            )}
            <section className="mt-8">
              <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Popular Artists</h2>
              {artistsLoading
                ? <div className="grid min-h-20 place-items-center"><Loader label="Loading popular artists" /></div>
                : similarArtists.length
                  ? <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                    {similarArtists.slice(0, 5).map((artist) => <ArtistCard key={artist.id} artist={artist} compact />)}
                  </div>
                  : <p className="text-sm text-white/45">No related artists available.</p>}
            </section>
            <section className="mt-8">
              {albumsLoading
                ? <><h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Related Albums</h2><div className="grid min-h-20 place-items-center"><Loader label="Loading related albums" /></div></>
                : relatedAlbums.length
                  ? <Albums albums={relatedAlbums} title="Related Albums" />
                  : <><h2 className="mb-3 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Related Albums</h2><p className="text-sm text-white/45">No related albums available.</p></>}
            </section>
            {recommendedPlaylists.length > 0 && (
              <section className="mt-8">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Recommended playlists</p>
                <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Playlists for you</h2>
                <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                  {recommendedPlaylists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
                </div>
              </section>
            )}
            <br /><br /><br /><br />
          </section>
        </div>
      )
    }

    return <>
      {queue.length ? <SortableQueueList
        tracks={queue}
        reorderQueue={reorderQueue}
        className="space-y-3 px-3 py-5"
        renderItem={(track, index, dragHandle) => (
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => playQueuedTrack(track)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
              <div className="cover-container h-10 w-10 shrink-0 bg-white/10">
                {getBestImageUrl(track.image) ? <img src={getBestImageUrl(track.image)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
                {isPlaying && String(currentTrack?.id) === String(track?.id) && <NowPlayingOverlay />}
              </div>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${index === currentIndex ? 'text-white' : 'text-white/75'}`}>{track.title || track.name}</span>
                <span className="mt-1 block truncate text-xs text-white/45">{track.artist || track.artistName}</span>
              </span>
              <span className="shrink-0 text-xs text-white/40">{formatTime(track.duration)}</span>
            </button>
            {dragHandle}
          </div>
        )}
      /> : <div className="px-5 py-5"><p className="py-6 text-center text-sm text-white/45">Your queue is empty.</p></div>}
      {isQueueLoading && <div className="grid min-h-16 place-items-center"><Loader label={`Finding songs (${queue.length}/50)`} /></div>}
    </>
  }

  if (!currentTrack) {
    return (
      <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-black px-8 text-center text-white/60 lg:hidden">
        <p>Choose a song to start listening.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-black text-white lg:hidden">
      <header className="flex items-center justify-between px-5 pt-5">
        <button type="button" aria-label="Minimize player" onClick={minimizePlayer} className="p-2 text-white">
          <ChevronDown size={25} />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Now playing</p>
        <SongActionsMenu song={currentTrack} queue={queue} alwaysVisible />
      </header>

      <main
        className="flex min-h-[calc(100dvh-7rem)] touch-none flex-col px-6 pb-5 pt-7"
        onTouchStart={handlePlayerTouchStart}
        onTouchMove={handlePlayerTouchMove}
        onTouchEnd={handlePlayerTouchEnd}
        style={{ transform: `translateY(${playerDragOffset}px)`, transition: playerDragOffset === 0 ? 'transform 220ms ease-out' : 'none' }}
      >
        <div
          className="mx-auto aspect-square w-full max-w-80 overflow-hidden bg-[#171717] shadow-[0_18px_70px_rgba(255,255,255,0.08)]"
          onTouchStart={handleArtworkTouchStart}
          onTouchMove={handleArtworkTouchMove}
          onTouchEnd={handleArtworkTouchEnd}
          onTouchCancel={() => {
            artworkSwipeStartRef.current = null
            setIsArtworkSwipeAnimating(true)
            setArtworkSwipeOffset(0)
          }}
          style={{
            transform: `translateX(${artworkSwipeOffset}px)`,
            transition: isArtworkSwipeAnimating ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
          }}
        >
          {image ? <img src={image} alt={currentTitle} className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
        </div>

        <div className="mt-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight">{currentTitle}</h1>
            <p className="mt-1 truncate text-sm text-white/60">{currentArtist || ' '}</p>
          </div>
          <button type="button" aria-label={isLiked(currentTrack.id) ? 'Unlike current song' : 'Like current song'} onClick={() => toggleLike(currentTrack)} className={`mt-1 p-2 hover:text-white ${isLiked(currentTrack.id) ? 'text-[#edeeee]' : 'text-white/70'}`}>
            <ThumbsUp size={21} fill={isLiked(currentTrack.id) ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="mt-5">
          <input aria-label="Track progress" className="h-0.5 w-full cursor-pointer accent-indigo-600/25" type="range" min="0" max={duration || 1} value={progress} onChange={(event) => seek(event.target.value)} />
          <div className="mt-3 flex justify-between text-[11px] text-white/55">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between px-1 text-white">
          <button type="button" aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} onClick={toggleShuffle} className={isShuffleEnabled ? 'text-[#8ba3ff]' : 'text-white/80'}>
            <Shuffle size={23} />
          </button>
          <button type="button" aria-label="Previous track" onClick={previous} className="p-2">
            <SkipBack size={30} fill="currentColor" />
          </button>
          <button type="button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-lg">
            {isPlaying ? <Pause size={35} fill="currentColor" /> : <Play className="ml-1" size={35} fill="currentColor" />}
          </button>
          <button type="button" aria-label="Next track" onClick={next} className="p-2">
            <SkipForward size={30} fill="currentColor" />
          </button>
          <button type="button" aria-label={isRepeatEnabled ? 'Disable repeat' : 'Enable repeat'} onClick={toggleRepeat} className={isRepeatEnabled ? 'text-[#8ba3ff]' : 'text-white/80'}>
            <Repeat2 size={23} />
          </button>
        </div>

        <button type="button" aria-label="Open queue, lyrics and related songs" onClick={() => setIsDetailsOpen(true)} className="mt-10 flex w-full items-center justify-center text-white/80 transition hover:text-white">
            <ChevronDown size={22} />
        </button>
      </main>

      <div className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${isDetailsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setIsDetailsOpen(false)}>
        <section
          role="dialog"
          aria-label="Player details"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          className={`absolute inset-x-0 bottom-0 h-dvh overflow-hidden rounded-t-xl border-t border-white/10 bg-[#101010] shadow-[0_-20px_80px_rgba(0,0,0,0.65)] ${detailsDragOffset ? '' : 'transition-transform duration-500 ease-out'} ${isDetailsOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ backgroundColor: detailsBackgroundColor, transform: `translateY(${isDetailsOpen ? detailsDragOffset : window.innerHeight}px)` }}
        >
          <div
            className="mx-4 mt-4 flex touch-none items-center gap-3 border-b border-white/10 pb-2"
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="cover-container h-11 w-11 shrink-0 bg-white/10">
              {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
            </div>
            <div 
              type="button"
              aria-label="Close player details"
              onClick={() => setIsDetailsOpen(false)}
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold">{currentTitle}</p>
              <p className="mt-0.5 truncate text-xs text-white/45">{currentArtist || ' '}</p>
            </div>
            <button onClick={toggleShuffle} aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} className={`hover:text-white ${isShuffleEnabled ? 'text-[#5b7cff]' : ''}`}>
              <Shuffle size={20} />
            </button>
            <button type="button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-transparent text-white">
                {isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}
            </button>
          </div>
          <div>
            <button
              type="button"
              aria-label="Close player details"
              onClick={() => setIsDetailsOpen(false)}
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="mx-auto mt-2 block h-1 w-12 touch-none rounded-full bg-white/30"
            />
            <div className="mx-5 mt-5 items-center justify-between">
              <MoodChips />
            </div>
            <div
              className="mt-7 flex touch-none border-b border-white/10 px-3"
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
            >
              {tabs.map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex-1 pb-4 text-[11px] font-bold ${activeTab === tab ? 'text-white' : 'text-white/45'}`}>
                  {tab}
                  {activeTab === tab && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-white" />}
                </button>
              ))}
            </div>
            <div
              ref={tabContentRef}
              className="max-h-[calc(98dvh-3.5rem)] overflow-y-auto scrollbar-none"
              onTouchStart={handleTabContentTouchStart}
              onTouchEnd={handleTabContentTouchEnd}
              onTouchCancel={() => { tabSwipeStartRef.current = null }}
            >
              {renderPanelContent()}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}