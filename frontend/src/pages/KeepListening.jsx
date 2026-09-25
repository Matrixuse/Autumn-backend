import { useEffect, useState } from 'react'
import { ListMusic, Pause, Play } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import axiosInstance from '../api/axiosInstance'
import { getBestImageUrl, getBestAudioUrl } from '../utils/mediaQuality'
import { formatTime } from '../utils/formatTime'
import { isLikelyHollywoodSong, searchSongs } from '../api/songs'
import { searchPlaylists } from '../api/playlists'
import Loader from '../components/common/Loader'
import SongActionsMenu from '../components/common/SongActionsMenu'

const tabs = ['UP NEXT', 'LYRICS', 'RELATED']

const normalizeSong = (song = {}) => ({
  ...song,
  id: song.id || song._id || `${song.name || song.title || 'song'}-${Math.random().toString(36).slice(2, 8)}`,
  title: song.name || song.title || 'Unknown Track',
  artist: Array.isArray(song.artists?.all)
    ? song.artists.all.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
    : song.artist || song.subtitle || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
  audio: getBestAudioUrl(song.downloadUrl || song.audio) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  language: song.language || song.lang || song.more_info?.language || 'unknown',
})

const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const artistParts = (value = '') => normalizeText(value).split(' ').filter((part) => part.length > 2)
const getTrackTitle = (track = {}) => track.title || track.name || ''
const getTrackArtist = (track = {}) => (
  track.artist
  || (Array.isArray(track.artists?.all) ? track.artists.all.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') : '')
  || (Array.isArray(track.artists?.primary) ? track.artists.primary.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') : '')
  || track.subtitle
  || ''
)

const rankRelatedSongs = (songs, currentTrack, isHollywood) => {
  const currentTitle = normalizeText(getTrackTitle(currentTrack))
  const currentArtist = normalizeText(getTrackArtist(currentTrack))
  const currentArtistParts = artistParts(getTrackArtist(currentTrack))
  const ranked = songs
    .map((song) => {
      const title = normalizeText(song.title)
      const artist = normalizeText(song.artist)
      const sameTitle = title === currentTitle || title.includes(currentTitle) || currentTitle.includes(title)
      const sharesArtist = currentArtistParts.some((part) => artist.includes(part)) || artist.includes(currentArtist)
      if (sameTitle && !sharesArtist) return null

      let score = 0
      if (sharesArtist) score += 100
      if (sameTitle) score += 30
      if (isLikelyHollywoodSong(song) === isHollywood) score += 20
      if (title.includes(currentTitle) || currentTitle.includes(title)) score += 10
      return { song, score }
    })
    .filter(Boolean)
    .sort((first, second) => second.score - first.score)

  const seenTitles = new Set()
  const seenIds = new Set([String(currentTrack.id)])
  return ranked.filter(({ song }) => {
    const titleKey = normalizeText(song.title)
    const idKey = String(song.id)
    if (seenIds.has(idKey) || seenTitles.has(titleKey)) return false
    seenIds.add(idKey)
    seenTitles.add(titleKey)
    return true
  }).map(({ song }) => song)
}

export default function KeepListening() {
  const { currentTrack, queue, listenHistory, isPlaying, playTrack, togglePlay } = usePlayer()
  const [activeTab, setActiveTab] = useState('UP NEXT')
  const [relatedSongs, setRelatedSongs] = useState([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [relatedArtists, setRelatedArtists] = useState([])
  const [relatedPlaylists, setRelatedPlaylists] = useState([])

  useEffect(() => {
    if (!currentTrack?.id) {
      setRelatedSongs([])
      return undefined
    }

    const controller = new AbortController()
    const loadTrackData = async () => {
      setRelatedLoading(true)
      setLyricsLoading(true)
      try {
        const trackTitle = getTrackTitle(currentTrack)
        const trackArtist = getTrackArtist(currentTrack)
        const artistQuery = String(trackArtist).split(',')[0].trim() || trackTitle
        const playlistQuery = `${trackTitle} ${artistQuery} playlist`.trim()
        const [lyricsResponse, artistsResponse, playlistsResponse] = await Promise.allSettled([
          axiosInstance.get(`/songs/${currentTrack.id}/lyrics`, { signal: controller.signal }),
          artistQuery
            ? axiosInstance.get('/search/artists', { params: { query: artistQuery, page: 0, limit: 6 }, signal: controller.signal })
            : Promise.resolve(null),
          playlistQuery ? searchPlaylists(playlistQuery, 5, 0) : Promise.resolve([])
        ])
        const nextLyrics = lyricsResponse.status === 'fulfilled' ? String(lyricsResponse.value.data?.data?.lyrics || '') : ''
        const artists = artistsResponse.status === 'fulfilled'
          ? (artistsResponse.value.data?.data?.results || []).slice(0, 6).map((artist) => ({
            id: artist.id,
            name: artist.name || artist.title || 'Artist',
            image: getBestImageUrl(artist.image)
          }))
          : []
        const playlists = playlistsResponse.status === 'fulfilled' ? playlistsResponse.value.slice(0, 5) : []
        if (!controller.signal.aborted) {
          setRelatedSongs([])
          setLyrics(nextLyrics)
          setRelatedArtists(artists)
          setRelatedPlaylists(playlists)
        }
      } catch {
        if (!controller.signal.aborted) {
          setRelatedSongs([])
          setLyrics('')
          setRelatedArtists([])
          setRelatedPlaylists([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setRelatedLoading(false)
          setLyricsLoading(false)
        }
      }
    }

    loadTrackData()
    return () => controller.abort()
  }, [currentTrack?.id])

  useEffect(() => {
    if (!currentTrack?.id) return undefined

    const controller = new AbortController()
    const loadRelatedSongs = async () => {
      try {
        const historyIds = new Set(listenHistory.map((song) => String(song.id)))
        const isHollywood = isLikelyHollywoodSong(currentTrack)
        const trackTitle = getTrackTitle(currentTrack)
        const artist = String(getTrackArtist(currentTrack)).split(',')[0].trim()
        const searchQueries = [
          `${artist} songs`.trim(),
          `${artist} latest songs`.trim(),
          trackTitle,
          `${trackTitle} ${artist}`.trim()
        ].filter(Boolean)
        const searchResults = await Promise.all(
          searchQueries.flatMap((query) => [0, 1].map((page) => searchSongs(query, 10, page).catch(() => [])))
        )
        const candidates = searchResults.flat().map(normalizeSong).filter((song) => !historyIds.has(String(song.id)))
        const suggestions = rankRelatedSongs(candidates, currentTrack, isHollywood)

        if (!controller.signal.aborted) {
          setRelatedSongs(suggestions.slice(0, 24))
        }
      } catch {
        if (!controller.signal.aborted) {
          setRelatedSongs([])
        }
      }
    }

    loadRelatedSongs()
    return () => controller.abort()
  }, [currentTrack?.id, listenHistory])

  const renderSongRow = (song, index) => {
    const isActive = song.id === currentTrack?.id
    const image = getBestImageUrl(song.image)
    return (
      <button
        type="button"
        key={`${song.id}-${index}`}
        onClick={() => playTrack(song)}
        className="flex w-full items-center gap-3 border-b border-gray-800 px-1 py-1 text-left transition hover:bg-white/6"
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden bg-white/10">
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
          {isActive && <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</span>}
        </div>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${isActive ? 'text-[#7e9aff]' : 'text-white'}`}>{song.title}</span>
          <span className="mt-0.5 block truncate text-xs text-white/45">{song.artist}</span>
        </span>
        <span className="text-xs text-white/40">{formatTime(song.duration)}</span>
      </button>
    )
  }

  const renderSongList = (songs, emptyText) => songs.length
    ? <div className="space-y-1">{songs.map(renderSongRow)}</div>
    : (
      <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-white/45">
        <div><ListMusic className="mx-auto mb-3 text-white/30" size={30} /><p>{emptyText}</p></div>
      </div>
    )

  const renderRelatedGrid = () => (
    <section className="mb-8">
      <div className="mb-5 px-1">
        <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Quick picks</p>
        <h2 className="font-['Space_Grotesk'] text-2xl font-bold leading-none text-white">For you</h2>
      </div>
      <div className="scrollbar-none auto-cols-72 grid grid-flow-col grid-rows-4 gap-x-3 gap-y-2 overflow-x-auto px-1 pb-3">
        {relatedSongs.slice(0, 24).map((song, index) => (
          <div key={song.id || `${song.title}-${index}`} role="button" tabIndex={0} onClick={() => playTrack(song, relatedSongs)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); playTrack(song, relatedSongs) } }} className="group flex h-16 min-w-0 items-center gap-3 rounded-lg bg-white/5 px-2 text-left transition hover:bg-white/10">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-white/10">
              {getBestImageUrl(song.image) ? <img src={getBestImageUrl(song.image)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{song.title}</span>
              <span className="mt-1 block truncate text-xs text-white/45">{song.artist}</span>
            </span>
            <span className="shrink-0 text-xs text-white/45">{formatTime(song.duration)}</span>
            <span onClick={(event) => event.stopPropagation()}><SongActionsMenu song={song} queue={relatedSongs} mobileAlwaysVisible /></span>
          </div>
        ))}
      </div>
    </section>
  )

  const renderArtistRail = () => (
    <section className="mt-6 space-y-5">
      <h3 className="px-1 text-2xl font-bold text-white">Related artists</h3>
      {relatedArtists.length ? (
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
          {relatedArtists.map((artist) => (
            <article key={artist.id || artist.name} className="w-35 min-w-35 text-center">
              <div className="mx-auto h-35 w-35 overflow-hidden rounded-full bg-white/10">
                {artist.image ? <img src={artist.image} alt={artist.name} className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
              </div>
              <p className="mt-2 truncate text-md font-semibold text-white">{artist.name}</p>
              <p className="mt-1 text-sm text-white/40">Artist</p>
            </article>
          ))}
        </div>
      ) : <p className="px-1 text-sm text-white/40">No related artists available.</p>}
    </section>
  )

  const renderPlaylistRail = () => (
    <section className="mt-6 space-y-5">
      <h3 className="px-1 text-2xl font-bold text-white">Recommended playlists</h3>
      {relatedPlaylists.length ? (
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
          {relatedPlaylists.map((playlist) => (
            <article key={playlist.id} className="w-35 min-w-35">
              <div className="aspect-square overflow-hidden rounded bg-white/10">
                {getBestImageUrl(playlist.image) ? <img src={getBestImageUrl(playlist.image)} alt={playlist.name} className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
              </div>
              <p className="mt-2 truncate text-md font-semibold text-white">{playlist.name}</p>
              <p className="mt-1 truncate text-sm text-white/40">{playlist.description || 'Playlist'}</p>
            </article>
          ))}
        </div>
      ) : <p className="px-1 text-xs text-white/40">No recommended playlists available.</p>}
      <br />
      <br />
    </section>
  )

  return (
    <div className="flex h-[calc(100vh-11rem)] animate-[queue-reveal_.45s_ease-out] flex-col gap-2 overflow-hidden rounded bg-linear-to-br from-[#0f0f0f] to-[#080a0c] shadow-2xl sm:flex-row">
      <div className="min-h-0 w-3/5 overflow-hidden md:w-1/2 sm:w-3/5">
        <div className="items-center justify-center">
          <h1 className="text-2xl font-bold">Keep Listening</h1>
          <button type="button" aria-label="Toggle current song" onClick={togglePlay}>
            <img 
              src={getBestImageUrl(currentTrack?.image)} 
              alt={currentTrack?.title || 'Current song'} 
              className="mt-4 max-h-[calc(100vh-16rem)] lg:w-full rounded-lg object-contain object-top md:w-150 sm:w-110" 
            />
          </button>
        </div>
      </div>

      <div className="min-h-0 min-w-0 w-2/5 md:w-1/2 sm:w-2/5">
        <div aria-label="Keep Listening details" className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-6 border-b border-white/10 px-2 justify-between">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap w-1/3 pb-4 pt-2 text-xs font-bold ${activeTab === tab ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
              >
                {tab}
                {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-2 py-4">
            <div>
              {activeTab === 'UP NEXT' && <><p className="text-xs text-white/55">Playing from</p><h2 className="mt-1 truncate text-base font-bold text-white">Your queue</h2></>}
              {activeTab === 'LYRICS' && <h2 className="text-base font-bold text-white">Lyrics</h2>}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thumb-gray-300">
            {activeTab === 'UP NEXT' && renderSongList(queue, 'Your queue is empty.')}
            {activeTab === 'RELATED' && (relatedLoading ? <div className="grid min-h-56 place-items-center"><Loader label="Loading related songs" /></div> : <>{relatedSongs.length ? renderRelatedGrid() : renderSongList([], 'No related songs available.')}{renderArtistRail()}{renderPlaylistRail()}</>)}
            {activeTab === 'LYRICS' && (lyricsLoading ? <div className="grid min-h-56 place-items-center"><Loader label="Loading lyrics" /></div> : <div className="whitespace-pre-wrap px-3 py-2 text-sm leading-7 text-white/80">{lyrics || 'Lyrics are not available for this song.'}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
