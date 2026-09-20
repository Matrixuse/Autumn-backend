import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Ban, ListEnd, ListPlus, MoreVertical, Pin, ThumbsUp, UserRound, Share2, Radio, X, Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../../context/PlayerContext'
import axiosInstance from '../../api/axiosInstance'
import { getBestAudioUrl, getBestImageUrl } from '../../utils/mediaQuality'

const getArtistId = (song) => song?.artists?.primary?.[0]?.id || song?.artists?.all?.[0]?.id || song?.artistId
const getArtistName = (song) => song?.artists?.primary?.[0]?.name || song?.artists?.all?.[0]?.name || String(song?.artist || '').split(',')[0].trim()

export default function SongActionsMenu({ song, queue = [], itemType = 'song', items = [], alwaysVisible = false, mobileAlwaysVisible = false }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { addToQueue, addTracksToQueue, isLiked, addToListenAgain, addToLibrary, removeFromLibrary, userPlaylists, isNotInterested, markNotInterested, restoreInterest, playTrack } = usePlayer()
  const title = song?.title || song?.name || 'this song'
  const isSong = itemType === 'song'
  const liked = isSong && isLiked(song?.id)
  const saved = isSong ? liked : userPlaylists.some((playlist) => String(playlist.sourceId || playlist.id) === String(song?.id))

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const bounds = trigger.getBoundingClientRect()
      const menuWidth = 224
      const menuHeight = 336
      const gap = 8
      const left = Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8))
      const top = bounds.bottom + menuHeight + gap <= window.innerHeight
        ? bounds.bottom + gap
        : Math.max(8, bounds.top - menuHeight - gap)

      setMenuPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 767px)').matches) return undefined

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [open])

  const close = () => setOpen(false)
  const resolveCollectionTracks = async () => {
    if (items.length) return items
    const endpoint = itemType === 'album' ? '/albums' : '/playlists'
    const response = await axiosInstance.get(endpoint, { params: { id: song?.id, limit: 1000 } })
    const tracks = response.data?.data?.songs || []
    return tracks.map((track) => ({
      id: track.id,
      title: track.name || track.title || 'Unknown Track',
      artist: (track.artists?.all || track.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || track.subtitle || 'Unknown Artist',
      image: getBestImageUrl(track.image),
      audio: getBestAudioUrl(track.downloadUrl || track.audio),
      duration: Number(track.duration || track.more_info?.duration || 0) || 0,
      raw: track,
    })).filter((track) => track.id && track.audio)
  }
  const playNext = async () => {
    setBusy(true)
    try {
      if (isSong) addToQueue(song, true)
      else addTracksToQueue(await resolveCollectionTracks(), true)
    } catch {
      // The menu remains usable if the collection endpoint is temporarily unavailable.
    } finally {
      setBusy(false)
      close()
    }
  }
  const addQueue = async () => {
    setBusy(true)
    try {
      if (isSong) addToQueue(song)
      else addTracksToQueue(await resolveCollectionTracks())
    } catch {
      // The menu remains usable if the collection endpoint is temporarily unavailable.
    } finally {
      setBusy(false)
      close()
    }
  }
  const saveToLibrary = () => {
    if (saved) removeFromLibrary(song, itemType)
    else addToLibrary(song, itemType)
    close()
  }
  const listenAgain = () => {
    if (isSong) addToListenAgain(song)
    close()
  }
  const dismiss = () => {
    if (isNotInterested(song)) restoreInterest(song)
    else markNotInterested(song)
    close()
  }
  const goToArtist = () => {
    const artistId = getArtistId(song)
    const artistName = getArtistName(song)
    if (artistId) navigate(`/artist/${encodeURIComponent(String(artistId))}/${encodeURIComponent(artistName || 'artist')}`)
    close()
  }

  const share = async () => {
    const shareUrl = window.location.href
    try {
      if (navigator.share) await navigator.share({ title, text: title, url: shareUrl })
      else await navigator.clipboard?.writeText(shareUrl)
    } catch {
      // Sharing can be cancelled by the user.
    } finally {
      close()
    }
  }

  const startMix = async () => {
    setBusy(true)
    try {
      const tracks = isSong ? queue : await resolveCollectionTracks()
      const shuffled = [...tracks].sort(() => Math.random() - 0.5)
      if (shuffled.length) playTrack(shuffled[0], shuffled)
    } finally {
      setBusy(false)
      close()
    }
  }

  const menuItems = [
    { label: 'Play next', icon: ListEnd, onClick: playNext },
    { label: 'Add to queue', icon: ListPlus, onClick: addQueue },
    { label: saved ? 'Remove from Liked Songs' : 'Add to Liked Songs', icon: ThumbsUp, onClick: saveToLibrary },
    { label: 'Save to playlist', icon: ListPlus, onClick: () => { navigate('/new-playlist', { state: { song } }); close() }, disabled: !isSong },
    { label: 'Go to artist', icon: UserRound, onClick: goToArtist, disabled: !isSong || !getArtistId(song) },
    { label: 'Add to Listen again', icon: Pin, onClick: listenAgain, disabled: !isSong },
    { label: isNotInterested(song) ? 'Interested again' : 'Not interested', icon: Ban, onClick: dismiss },
  ]

  const mobileListItems = [
    { label: 'Play next', icon: ListEnd, onClick: playNext },
    { label: 'Save to playlist', icon: ListPlus, onClick: () => { navigate('/new-playlist', { state: { song } }); close() }, disabled: !isSong },
    { label: 'Start mix', icon: Radio, onClick: startMix },
    { label: 'Add to queue', icon: ListPlus, onClick: addQueue },
    { label: saved ? 'Remove from library' : 'Save to library', icon: Bookmark, onClick: saveToLibrary },
    ...menuItems.slice(4),
  ]

  return (
    <div ref={menuRef} className="relative z-30" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More options for ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-8 w-8 place-items-center rounded-full bg-transparent text-white transition focus-visible:opacity-100 ${alwaysVisible ? 'opacity-100' : mobileAlwaysVisible ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <MoreVertical size={20} />
      </button>

      {open && menuPosition && createPortal(
        <div ref={menuRef} style={{ left: menuPosition.left, top: menuPosition.top }} className="fixed z-100 hidden w-56 overflow-hidden rounded border border-white/10 bg-[#242424] p-1 shadow-2xl md:block" role="menu" aria-label={`Actions for ${title}`}>
          {menuItems.map(({ label, icon: Icon, onClick, disabled }) => (
            <button key={label} type="button" role="menuitem" disabled={disabled || busy} onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-100 flex items-end bg-black/60 md:hidden" role="presentation" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); close() }}>
          <section className="w-full rounded-t-[20px] border-t border-white/10 bg-[#1d1d1d] pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-[sheet-up_280ms_ease-out]" role="dialog" aria-modal="true" aria-label={`Actions for ${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-white/25" />
            <div className="flex items-start gap-4 border-b border-white/15 px-5 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-white">{title}</h2>
                <p className="line-clamp-2 text-sm text-white/65">{isSong ? getArtistName(song) || 'Unknown Artist' : song?.description || 'Your collection'}</p>
              </div>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); close() }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Close actions">
                <X size={25} />
              </button>
            </div>
            <div className="px-5">
              {mobileListItems.map(({ label, icon: Icon, onClick, disabled }) => (
                <button key={label} type="button" role="menuitem" disabled={disabled || busy} onClick={onClick} className="flex w-full items-center gap-2 rounded px-1 py-3 text-left text-md text-white transition hover:bg-white/10 disabled:opacity-40">
                  <Icon size={30} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
