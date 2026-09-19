import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Ban, ListEnd, ListPlus, MoreVertical, Pin, ThumbsUp, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../../context/PlayerContext'
import axiosInstance from '../../api/axiosInstance'
import { getBestAudioUrl, getBestImageUrl } from '../../utils/mediaQuality'

const getArtistId = (song) => song?.artists?.primary?.[0]?.id || song?.artists?.all?.[0]?.id || song?.artistId
const getArtistName = (song) => song?.artists?.primary?.[0]?.name || song?.artists?.all?.[0]?.name || String(song?.artist || '').split(',')[0].trim()

export default function SongActionsMenu({ song, queue = [], itemType = 'song', items = [], alwaysVisible = false }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { addToQueue, addTracksToQueue, isLiked, addToListenAgain, addToLibrary, removeFromLibrary, userPlaylists, isNotInterested, markNotInterested, restoreInterest } = usePlayer()
  const title = song?.title || song?.name || 'this song'
  const isSong = itemType === 'song'
  const liked = isSong && isLiked(song?.id)
  const saved = isSong ? liked : userPlaylists.some((playlist) => String(playlist.sourceId || playlist.id) === String(song?.id))

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false)
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

  const menuItems = [
    { label: 'Play next', icon: ListEnd, onClick: playNext },
    { label: 'Add to queue', icon: ListPlus, onClick: addQueue },
    { label: saved ? 'Remove from Liked Songs' : 'Add to Liked Songs', icon: ThumbsUp, onClick: saveToLibrary },
    { label: 'Save to playlist', icon: ListPlus, onClick: () => { navigate('/new-playlist', { state: { song } }); close() }, disabled: !isSong },
    { label: 'Go to artist', icon: UserRound, onClick: goToArtist, disabled: !isSong || !getArtistId(song) },
    { label: 'Add to Listen again', icon: Pin, onClick: listenAgain, disabled: !isSong },
    { label: isNotInterested(song) ? 'Interested again' : 'Not interested', icon: Ban, onClick: dismiss },
  ]

  return (
    <div ref={menuRef} className="relative z-30" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More options for ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-8 w-8 place-items-center rounded-full bg-transparent text-white transition focus-visible:opacity-100 ${alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        <MoreVertical size={20} />
      </button>

      {open && menuPosition && createPortal(
        <div ref={menuRef} style={{ left: menuPosition.left, top: menuPosition.top }} className="fixed z-100 w-56 overflow-hidden rounded border border-white/10 bg-[#242424] p-1 shadow-2xl" role="menu" aria-label={`Actions for ${title}`}>
          {menuItems.map(({ label, icon: Icon, onClick, disabled }) => (
            <button key={label} type="button" role="menuitem" disabled={disabled || busy} onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
