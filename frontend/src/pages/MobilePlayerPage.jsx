import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ThumbsUp, EllipsisVertical, MessageCircle, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import axiosInstance from '../api/axiosInstance'
import { getBestImageUrl } from '../utils/mediaQuality'
import { formatTime } from '../utils/formatTime'
import SongActionsMenu from '../components/common/SongActionsMenu'
import { searchPlaylists } from '../api/playlists'
import ArtistCard from '../components/cards/ArtistCard'
import PlaylistCard from '../components/cards/PlaylistCard'
import SongCard from '../components/cards/SongCard'

const tabs = ['UP NEXT', 'LYRICS', 'RELATED']

export default function MobilePlayerPage({ song }) {
  const navigate = useNavigate()
  const {
    currentTrack,
    queue,
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
    playTrack,
    isLiked,
    toggleLike
  } = usePlayer()
  const [activeTab, setActiveTab] = useState('UP NEXT')
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsDragOffset, setDetailsDragOffset] = useState(0)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [recommendedPlaylists, setRecommendedPlaylists] = useState([])
  const [similarArtists, setSimilarArtists] = useState([])
  const gestureStartRef = useRef(null)

  const image = getBestImageUrl(currentTrack?.image)
  const currentIndex = queue.findIndex((track) => String(track.id) === String(currentTrack?.id))
  const nextTracks = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue

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
      setSimilarArtists([])
      return undefined
    }

    const controller = new AbortController()
    const artistName = String(currentTrack.artist || currentTrack.subtitle || '').split(',')[0].trim()
    const playlistQuery = `${currentTrack.title || ''} ${artistName} playlist`.trim()

    const loadRelatedSections = async () => {
      const [playlistResult, artistResult] = await Promise.allSettled([
        searchPlaylists(playlistQuery, 8, 0),
        axiosInstance.get('/search/artists', { params: { query: artistName || currentTrack.title, page: 0, limit: 8 }, signal: controller.signal })
      ])

      if (controller.signal.aborted) return

      const playlists = playlistResult.status === 'fulfilled' ? playlistResult.value : []
      const artists = artistResult.status === 'fulfilled' ? artistResult.value.data?.data?.results || [] : []
      const currentArtistKey = artistName.toLowerCase()

      setRecommendedPlaylists(playlists.filter((playlist, index, items) => items.findIndex((item) => String(item.id) === String(playlist.id)) === index).slice(0, 8))
      setSimilarArtists(artists
        .filter((artist) => String(artist.name || artist.title || '').trim().toLowerCase() !== currentArtistKey)
        .map((artist) => ({
          id: artist.id,
          name: artist.name || artist.title || 'Artist',
          image: getBestImageUrl(artist.image || artist.images || artist.image_url || artist.thumbnail || artist.cover || [])
        }))
        .filter((artist) => artist.id)
        .slice(0, 8))
    }

    loadRelatedSections()
    return () => controller.abort()
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.subtitle, listenHistory])

  const minimizePlayer = () => {
    navigate(-1)
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

  const renderPanelContent = () => {
    if (activeTab === 'LYRICS') {
      return <div className="whitespace-pre-wrap px-5 py-6 text-sm leading-7 text-white/75">{lyricsLoading ? 'Loading lyrics...' : lyrics || 'Lyrics are not available for this song.'}</div>
    }

    if (activeTab === 'RELATED') {
      return (
        <div className="px-5 py-3">
          {relatedTracks.length ? (
            <section>
              <div className="mb-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Quick picks</p>
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">For you</h2>
              </div>
              <div className="scrollbar-none grid auto-cols-80 grid-flow-col grid-rows-4 gap-x-2 gap-y-1 overflow-x-auto pb-3">
                {relatedTracks.map((track, index) => (
                  <div key={track.id || `${track.title}-${index}`} role="button" tabIndex={0} onClick={() => playTrack(track, relatedTracks)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); playTrack(track, relatedTracks) } }} className="group flex h-16 min-w-0 items-center gap-3 rounded-lg bg-black/5 px-2 text-left transition hover:bg-white/10">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/10">
                      {getBestImageUrl(track.image) ? <img src={getBestImageUrl(track.image)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
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
              {recommendedPlaylists.length > 0 && (
                <section className="mt-8">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Recommended playlists</p>
                  <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Playlists for you</h2>
                  <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                    {recommendedPlaylists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
                  </div>
                </section>
              )}
              {similarArtists.length > 0 && (
                <section className="mt-8">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Similar artists</p>
                  <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Artists you may like</h2>
                  <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                    {similarArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} compact />)}
                  </div>
                </section>
              )}
              {recommendedTracks.length > 0 && (
                <section className="mt-8 pb-8">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Your moods</p>
                  <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">Moods for you</h2>
                  <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
                    {recommendedTracks.slice(0, 8).map((track) => <SongCard key={track.id} song={track} queue={recommendedTracks} />)}
                  </div>
                </section>
              )}
              <br />
              <br />
              <br />
              <br />
            </section>
          ) : <p className="py-6 text-center text-sm text-white/45">No related songs available.</p>}
        </div>
      )
    }

    return (
      <div className="space-y-3 px-5 py-5">
        {recommendedTracks.length ? recommendedTracks.map((track) => (
          <button key={track.id} type="button" onClick={() => playTrack(track)} className="flex w-full items-center gap-3 text-left">
            <div className="h-12 w-12 shrink-0 overflow-hidden bg-white/10">
              {getBestImageUrl(track.image) ? <img src={getBestImageUrl(track.image)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{track.title}</span>
              <span className="mt-1 block truncate text-xs text-white/45">{track.artist}</span>
            </span>
            <span className="text-xs text-white/40">{formatTime(track.duration)}</span>
          </button>
        )) : <p className="py-6 text-center text-sm text-white/45">Your queue is empty.</p>}
      </div>
    )
  }

  useEffect(() => {
    if (!currentTrack?.id) return undefined
    const controller = new AbortController()
    setLyricsLoading(true)
    axiosInstance.get(`/songs/${currentTrack.id}/lyrics`, { signal: controller.signal })
      .then((response) => setLyrics(String(response.data?.data?.lyrics || '')))
      .catch(() => setLyrics(''))
      .finally(() => {
        if (!controller.signal.aborted) setLyricsLoading(false)
      })
    return () => controller.abort()
  }, [currentTrack?.id])

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
        className="flex min-h-[calc(100dvh-7rem)] flex-col px-6 pb-5 pt-7"
      >
        <div className="mx-auto aspect-square w-full max-w-80 overflow-hidden bg-[#171717] shadow-[0_18px_70px_rgba(255,255,255,0.08)]">
          {image ? <img src={image} alt={currentTrack.title} className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
        </div>

        <div className="mt-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight">{currentTrack.title}</h1>
            <p className="mt-1 truncate text-sm text-white/60">{currentTrack.artist}</p>
          </div>
          <button type="button" aria-label={isLiked(currentTrack.id) ? 'Unlike current song' : 'Like current song'} onClick={() => toggleLike(currentTrack)} className={`mt-1 p-2 hover:text-white ${isLiked(currentTrack.id) ? 'text-[#edeeee]' : 'text-white/70'}`}>
            <ThumbsUp size={21} fill={isLiked(currentTrack.id) ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="mt-5">
          <input aria-label="Track progress" className="h-0.5 w-full cursor-pointer accent-white/25" type="range" min="0" max={duration || 1} value={progress} onChange={(event) => seek(event.target.value)} />
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
          // onTouchStart={handleSheetTouchStart}
          // onTouchMove={handleSheetTouchMove}
          // onTouchEnd={handleSheetTouchEnd}
          className={`absolute inset-x-0 bottom-0 h-dvh overflow-hidden rounded-t-xl border-t border-white/10 bg-[#101010] shadow-[0_-20px_80px_rgba(0,0,0,0.65)] ${detailsDragOffset ? '' : 'transition-transform duration-500 ease-out'} ${isDetailsOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ transform: `translateY(${isDetailsOpen ? detailsDragOffset : window.innerHeight}px)` }}
        >
          <div
            className="mx-4 mt-4 flex touch-none items-center gap-3 border-b border-white/10 pb-2"
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden bg-white/10">
              {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold">{currentTrack.title}</p>
              <p className="mt-0.5 truncate text-xs text-white/45">{currentTrack.artist}</p>
            </div>
            <button onClick={toggleShuffle} aria-label={isShuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'} className={`hover:text-white ${isShuffleEnabled ? 'text-[#5b7cff]' : ''}`}>
              <Shuffle size={20} />
            </button>
            <button type="button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-transparent text-white">
                {isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}
            </button>
          </div>
          <button
            type="button"
            aria-label="Close player details"
            onClick={() => setIsDetailsOpen(false)}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
            className="mx-auto mt-3 block h-1 w-12 touch-none rounded-full bg-white/30"
          />
          <div
            className="mt-3 flex touch-none border-b border-white/10 px-3"
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
          <div className="max-h-[calc(98dvh-3.5rem)] overflow-y-auto scrollbar-none">
            {renderPanelContent()}
          </div>
        </section>
      </div>
    </div>
  )
}