import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal, Clock3, X, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { usePlayer } from '../../context/PlayerContext'
import { getBestAudioUrl, getBestImageUrl } from '../../utils/mediaQuality'

const HISTORY_KEY = 'autumn_search_history'

const readHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const persistHistory = (items) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

const formatResultLabel = (item, type) => {
  if (type === 'artist') return item?.name || item?.title || 'Artist'
  if (type === 'playlist') return item?.title || item?.name || 'Playlist'
  return item?.name || item?.title || 'Song'
}

const formatResultMeta = (item, type) => {
  if (type === 'artist') {
    const audience = item?.fans || item?.monthlyListeners || item?.followerCount
    return audience ? `${Number(audience).toLocaleString()} monthly audience` : 'Artist'
  }

  if (type === 'playlist') {
    return item?.subtitle || item?.description || 'Playlist'
  }

  return `${item?.artist || item?.subtitle || 'Song'} • ${item?.album || 'Music'}`
}

const extractImageUrl = (value) => {
  if (!value) return ''

  if (typeof value === 'string') {
    return value.trim() || ''
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractImageUrl(entry)
      if (nested) return nested
    }
    return ''
  }

  if (typeof value === 'object') {
    const direct = value.url || value.src || value.link || value.image || value.thumbnail || value.cover
    if (typeof direct === 'string' && direct.trim()) return direct.trim()

    for (const nestedValue of Object.values(value)) {
      const nested = extractImageUrl(nestedValue)
      if (nested) return nested
    }
  }

  return ''
}

const getResultImage = (item, type) => {
  if (!item) return ''

  const candidateImage = extractImageUrl(item?.image || item?.cover || item?.thumbnail || item?.artwork || item?.img || item?.coverImage)
  if (candidateImage) return candidateImage

  if (type === 'artist' && item?.image && typeof item.image === 'object') {
    return extractImageUrl(item.image)
  }

  if (type === 'playlist' && item?.playlistImage) {
    return extractImageUrl(item.playlistImage)
  }

  return getBestImageUrl(item?.image || item?.cover || item?.thumbnail || []) || ''
}

export default function SearchBar({ disabled = false, onSearchStateChange }) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState(() => readHistory())
  const [results, setResults] = useState([])
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { playTrack } = usePlayer()

  const showHistory = focused && !query.trim()
  const showResults = focused && query.trim().length > 0

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    let isCancelled = false

    const fetchResults = async () => {
      setLoading(true)
      try {
        const [songsResponse, artistsResponse, playlistsResponse] = await Promise.all([
          axiosInstance.get('/search/songs', { params: { query: trimmed, page: 0, limit: 6 } }),
          axiosInstance.get('/search/artists', { params: { query: trimmed, page: 0, limit: 2 } }),
          axiosInstance.get('/search/playlists', { params: { query: trimmed, page: 0, limit: 2 } })
        ])

        if (isCancelled) return

        const songs = (songsResponse.data?.data?.results || []).map((item) => ({ ...item, __type: 'song' }))
        const artists = (artistsResponse.data?.data?.results || []).map((item) => ({ ...item, __type: 'artist' }))
        const playlists = (playlistsResponse.data?.data?.results || []).map((item) => ({ ...item, __type: 'playlist' }))

        const combined = [...songs, ...artists, ...playlists].slice(0, 10)
        setResults(combined)
      } catch {
        if (!isCancelled) setResults([])
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    const timer = setTimeout(fetchResults, 220)
    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const recentHistory = useMemo(() => history, [history])

  useEffect(() => {
    onSearchStateChange?.({ query, history: recentHistory, results, loading })
  }, [history, loading, onSearchStateChange, query, recentHistory, results])

  const addToHistory = (value) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return

    setHistory((current) => {
      const filtered = current.filter((entry) => entry !== trimmed)
      const next = [trimmed, ...filtered]
      persistHistory(next)
      return next
    })
  }

  const removeFromHistory = (value) => {
    setHistory((current) => {
      const next = current.filter((entry) => entry !== value)
      persistHistory(next)
      return next
    })
  }

  const handleSelect = async (value, item) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return

    addToHistory(trimmed)

    const clearSelection = () => {
      setQuery('')
      setResults([])
      setFocused(false)
      inputRef.current?.blur()
    }

    if (item?.__type === 'song') {
      try {
        const songDetails = await axiosInstance.get(`/songs/${item.id}`)
        const songData = Array.isArray(songDetails.data?.data) ? songDetails.data.data[0] : songDetails.data?.data || {}

        const normalizedSong = {
          id: songData?.id || item.id,
          title: songData?.title || songData?.name || item.title || item.name || trimmed,
          name: songData?.title || songData?.name || item.title || item.name || trimmed,
          artist: songData?.artists?.all?.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || item?.artist || item?.subtitle || 'Unknown Artist',
          image: getResultImage(songData || item, 'song') || getBestImageUrl(songData?.image || item?.image || []),
          audio: getBestAudioUrl(songData?.downloadUrl || item?.downloadUrl),
          duration: Number(songData?.duration || item?.duration || 0) || null,
          album: songData?.album || item?.album || null,
          url: songData?.url || item?.url || null,
          language: songData?.language || item?.language || 'hindi'
        }

        if (normalizedSong.audio) {
          playTrack(normalizedSong, [normalizedSong])
          clearSelection()
          return
        }
      } catch {
        // fall through to normal search behavior if the song cannot be resolved for playback
      }
    }

    if (item?.__type === 'artist' && item.id) {
      navigate(`/artist/${encodeURIComponent(String(item.id))}/${encodeURIComponent(trimmed)}`)
    } else if (item?.__type === 'playlist' && item.id) {
      navigate(`/playlist/${encodeURIComponent(String(item.id))}/${encodeURIComponent(trimmed)}`)
    }
    clearSelection()
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setFocused(true)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const handleSearchCommand = (event) => {
      const { type, value, item } = event.detail || {}
      if (type === 'select-history') handleSelect(value, { __type: 'history' })
      if (type === 'select-result') handleSelect(value, item)
      if (type === 'remove-history') removeFromHistory(value)
    }

    window.addEventListener('autumn-search-command', handleSearchCommand)
    return () => window.removeEventListener('autumn-search-command', handleSearchCommand)
  })

  return (
    <div className={`relative md:ml-14 w-full min-w-[340px] ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex items-center gap-1 md:gap-3 rounded-lg border border-white/10 bg-[#2d2f31] px-4 py-2.5 text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <Search size={18} className="text-white/70" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/45 disabled:cursor-not-allowed disabled:text-white/35"
          placeholder="Search songs, albums, artists, playlists..."
        />
        {query ? (
          <button type="button" onClick={handleClear} className="grid place-items-center rounded-md p-1 text-white/60 transition hover:bg-white/5 hover:text-white" aria-label="Clear search">
            <X size={15} />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && navigate('/equalizer')}
            className="grid place-items-center rounded-md p-1 text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed"
            aria-label="Advanced search"
          >
            <SlidersHorizontal size={16} />
          </button>
        )}
      </div>

      {focused && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] hidden overflow-hidden rounded border border-white/10 bg-[#17191a]/95 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-md lg:block">
          {showHistory && recentHistory.length > 0 && (
            <div className="py-1.5">
              {recentHistory.map((item) => (
                <div key={item} className="flex items-center justify-between gap-1 px-3 py-2 text-white/75 transition hover:bg-white/5">
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelect(item, { __type: 'history' })} className="flex flex-1 items-center gap-3 text-left">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-white/60">
                      <Clock3 size={13} />
                    </span>
                    <span className="text-sm font-medium text-white/85">{item}</span>
                  </button>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => removeFromHistory(item)} className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white/80" aria-label={`Remove ${item}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showResults && (
            <div className="max-h-[520px] scrollbar-none overflow-y-auto py-1.5">
              {loading ? (
                <div className="px-4 py-3 text-sm text-white/50">Searching…</div>
              ) : results.length > 0 ? (
                results.map((item, index) => (
                  <button
                    key={`${item.__type}-${item.id || item.name || item.title || index}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(formatResultLabel(item, item.__type), item)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                  >
                    <span className="relative h-9 w-9 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                      {getResultImage(item, item.__type) ? (
                        <img
                          src={getResultImage(item, item.__type)}
                          alt={formatResultLabel(item, item.__type)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-white/70">
                          <Search size={12} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{formatResultLabel(item, item.__type)}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/45">{formatResultMeta(item, item.__type)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-white/50">No results found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}