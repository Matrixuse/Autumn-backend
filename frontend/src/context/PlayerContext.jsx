import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import PlayerContext from './player-context'
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality'
import { buildUpNextQueue, normalizeRecommendationSong, resolveQueueSelection } from '../utils/recommendationQueue'
import axiosInstance from '../api/axiosInstance'

const HISTORY_LIMIT = 18

const readHistory = () => {
  try {
    const raw = localStorage.getItem('autumn_listen_history')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readLikedSongs = () => {
  try {
    const raw = localStorage.getItem('autumn_liked_songs')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readUserPlaylists = () => {
  try {
    const raw = localStorage.getItem('autumn_user_playlists')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readStoredList = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const pushHistory = (history, track) => {
  if (!track || !track.id) return history

  const next = history.filter((entry) => entry && entry.id !== track.id)
  const merged = [{ ...track }, ...next].slice(0, HISTORY_LIMIT)
  return merged
}

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [isQueueLoading, setIsQueueLoading] = useState(false)
  const [listenHistory, setListenHistory] = useState(() => readHistory())
  const [likedSongs, setLikedSongs] = useState(() => readLikedSongs())
  const [userPlaylists, setUserPlaylists] = useState(() => readUserPlaylists())
  const [listenAgain, setListenAgain] = useState(() => readStoredList('autumn_listen_again'))
  const [notInterested, setNotInterested] = useState(() => readStoredList('autumn_not_interested'))
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [mediaPositionRequest, setMediaPositionRequest] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false)
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const recommendationRequestRef = useRef(0)
  const shufflePlayedIdsRef = useRef(new Set())
  const lastMediaPositionUpdateRef = useRef(0)
  const forceMediaPositionUpdateRef = useRef(false)
  const lastMediaTrackIdRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('autumn_listen_history', JSON.stringify(listenHistory))
  }, [listenHistory])

  useEffect(() => {
    localStorage.setItem('autumn_liked_songs', JSON.stringify(likedSongs))
  }, [likedSongs])

  useEffect(() => {
    localStorage.setItem('autumn_user_playlists', JSON.stringify(userPlaylists))
  }, [userPlaylists])

  useEffect(() => {
    localStorage.setItem('autumn_listen_again', JSON.stringify(listenAgain))
  }, [listenAgain])

  useEffect(() => {
    localStorage.setItem('autumn_not_interested', JSON.stringify(notInterested))
  }, [notInterested])

  const playTrack = (track, selectedQueue) => {
    if (!track) return

    const selection = resolveQueueSelection(Array.isArray(selectedQueue) ? selectedQueue : queue, track)

    if (!selection.shouldRegenerate) {
      if (Array.isArray(selectedQueue)) {
        recommendationRequestRef.current += 1
        setIsQueueLoading(false)
        setQueue(selection.queue)
      }
      if (isShuffleEnabled) shufflePlayedIdsRef.current.add(String(selection.track.id))
      setCurrentIndex(selection.currentIndex)
      setCurrentTrack(selection.track)
      setListenHistory((history) => pushHistory(history, selection.track))
      setProgress(0)
      setIsPlaying(true)
      return
    }

    recommendationRequestRef.current += 1
    const requestId = recommendationRequestRef.current
    const sourceTrack = normalizeRecommendationSong(selection.track)
    if (isShuffleEnabled) shufflePlayedIdsRef.current = new Set([String(sourceTrack.id)])
    setCurrentTrack(sourceTrack)
    setQueue([sourceTrack])
    setCurrentIndex(0)
    setIsQueueLoading(true)
    setListenHistory((history) => pushHistory(history, sourceTrack))
    setProgress(0)
    setIsPlaying(true)

    buildUpNextQueue(sourceTrack, axiosInstance, {
      targetLength: 50,
      history: listenHistory,
      onUpdate: (nextQueue) => {
        if (recommendationRequestRef.current === requestId) setQueue(nextQueue)
      }
    }).then((nextQueue) => {
      if (recommendationRequestRef.current !== requestId) return
      setQueue(nextQueue)
      setCurrentIndex(0)
    }).catch(() => {
      if (recommendationRequestRef.current === requestId) setQueue([sourceTrack])
    }).finally(() => {
      if (recommendationRequestRef.current === requestId) setIsQueueLoading(false)
    })
  }

  const togglePlay = () => setIsPlaying((playing) => !playing)
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
    setIsPlaying(false)
    setCurrentTrack(null)
    setQueue([])
    setIsQueueLoading(false)
    setCurrentIndex(-1)
    recommendationRequestRef.current += 1
    setProgress(0)
    setDuration(0)
  }
  const isLiked = (trackId) => likedSongs.some((song) => String(song.id) === String(trackId))
  const toggleLike = (track) => {
    if (!track?.id) return

    setLikedSongs((songs) => {
      if (songs.some((song) => String(song.id) === String(track.id))) {
        return songs.filter((song) => String(song.id) !== String(track.id))
      }

      return [{ ...track }, ...songs]
    })
  }
  const addToQueue = (track, playNext = false) => {
    if (!track?.id) return

    const withoutTrack = queue.filter((item) => String(item.id) !== String(track.id))
    const activeIndex = withoutTrack.findIndex((item) => String(item.id) === String(currentTrack?.id))
    const insertionIndex = activeIndex < 0 ? (playNext ? 0 : withoutTrack.length) : playNext ? activeIndex + 1 : withoutTrack.length
    const nextQueue = [...withoutTrack]
    nextQueue.splice(insertionIndex, 0, track)
    setQueue(nextQueue)
    const nextIndex = nextQueue.findIndex((item) => String(item.id) === String(currentTrack?.id))
    if (nextIndex >= 0) setCurrentIndex(nextIndex)
  }
  const addTracksToQueue = (tracks, playNext = false) => {
    const validTracks = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.id)
    if (!validTracks.length) return

    const additions = validTracks.filter((track) => !queue.some((item) => String(item.id) === String(track.id)))
    if (!additions.length) return
    const activeIndex = queue.findIndex((item) => String(item.id) === String(currentTrack?.id))
    const insertionIndex = activeIndex < 0 ? (playNext ? 0 : queue.length) : playNext ? activeIndex + 1 : queue.length
    const nextQueue = [...queue]
    nextQueue.splice(insertionIndex, 0, ...additions)
    setQueue(nextQueue)
    const nextIndex = nextQueue.findIndex((item) => String(item.id) === String(currentTrack?.id))
    if (nextIndex >= 0) setCurrentIndex(nextIndex)
  }
  const reorderQueue = (fromIndex, toIndex) => {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length || fromIndex === toIndex) return

    const playingTrackId = currentTrack?.id
    const nextQueue = [...queue]
    const [movedTrack] = nextQueue.splice(fromIndex, 1)
    nextQueue.splice(toIndex, 0, movedTrack)
    setQueue(nextQueue)

    const nextCurrentIndex = playingTrackId == null
      ? -1
      : nextQueue.findIndex((track) => String(track.id) === String(playingTrackId))
    setCurrentIndex(nextCurrentIndex)
  }
  const addToListenAgain = (track) => {
    if (!track?.id) return
    setListenAgain((items) => [{ ...track }, ...items.filter((item) => String(item.id) !== String(track.id))].slice(0, HISTORY_LIMIT))
  }
  const isNotInterested = (item) => notInterested.includes(String(item?.id))
  const markNotInterested = (item) => {
    if (item?.id) setNotInterested((items) => [...new Set([...items, String(item.id)])])
  }
  const restoreInterest = (item) => {
    if (item?.id) setNotInterested((items) => items.filter((id) => id !== String(item.id)))
  }
  const addToLibrary = (item, type = 'song') => {
    if (!item?.id) return
    if (type === 'song') {
      toggleLike(item)
      return
    }
    setUserPlaylists((items) => {
      if (items.some((playlist) => String(playlist.sourceId || playlist.id) === String(item.id))) return items
      return [{ ...item, id: `saved-${type}-${item.id}`, sourceId: item.id, savedType: type, isSaved: true, songs: item.songs || [] }, ...items]
    })
  }
  const removeFromLibrary = (item, type = 'song') => {
    if (!item?.id) return
    if (type === 'song') {
      setLikedSongs((songs) => songs.filter((song) => String(song.id) !== String(item.id)))
      return
    }
    setUserPlaylists((items) => items.filter((playlist) => String(playlist.sourceId || playlist.id) !== String(item.id)))
  }
  const next = () => {
    let nextIndex
    let nextTrack
    if (isShuffleEnabled) {
      const candidates = queue
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => track?.id && !shufflePlayedIdsRef.current.has(String(track.id)))
      if (!candidates.length) return
      const selection = candidates[Math.floor(Math.random() * candidates.length)]
      nextIndex = selection.index
      nextTrack = selection.track
      shufflePlayedIdsRef.current.add(String(nextTrack.id))
    } else {
      nextIndex = currentIndex + 1
      nextTrack = queue[nextIndex]
    }
    if (!nextTrack) return
    recommendationRequestRef.current += 1
    setCurrentIndex(nextIndex)
    setCurrentTrack(nextTrack)
    setListenHistory((history) => pushHistory(history, nextTrack))
    setProgress(0)
    setIsPlaying(true)
  }
  const previous = () => {
    const previousIndex = currentIndex - 1
    const previousTrack = queue[previousIndex]
    if (!previousTrack) return
    recommendationRequestRef.current += 1
    setCurrentIndex(previousIndex)
    setCurrentTrack(previousTrack)
    setListenHistory((history) => pushHistory(history, previousTrack))
    setProgress(0)
    setIsPlaying(true)
  }
  const seek = (value) => {
    const requestedPosition = Number(value)
    if (!Number.isFinite(requestedPosition)) return
    const position = Math.max(0, Number.isFinite(duration) && duration > 0 ? Math.min(requestedPosition, duration) : requestedPosition)
    setProgress(position)
    if (audioRef.current) audioRef.current.currentTime = position
    forceMediaPositionUpdateRef.current = true
    setMediaPositionRequest((request) => request + 1)
  }
  const handleTimeUpdate = (event) => {
    setProgress(Number(event.currentTarget?.currentTime) || 0)
  }
  const handleLoadedMetadata = (event) => {
    setDuration(Number(event.currentTarget?.duration) || 0)
    forceMediaPositionUpdateRef.current = true
    setMediaPositionRequest((request) => request + 1)
  }
  const handleEnded = () => {
    if (isRepeatEnabled) {
      setProgress(0)
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }
      return
    }
    next()
  }
  const toggleShuffle = () => {
    const nextEnabled = !isShuffleEnabled
    shufflePlayedIdsRef.current = nextEnabled && currentTrack?.id
      ? new Set([String(currentTrack.id)])
      : new Set()
    setIsShuffleEnabled(nextEnabled)
  }
  const toggleRepeat = () => setIsRepeatEnabled((enabled) => !enabled)
  const toggleQueue = () => setIsQueueOpen((open) => !open)
  const closeQueue = () => setIsQueueOpen(false)
  const audioSource = currentTrack?.audio || getBestAudioUrl(currentTrack?.downloadUrl)
  const { audioRef } = useAudioPlayer({ src: audioSource, isPlaying, volume, onTimeUpdate: handleTimeUpdate, onEnded: handleEnded })

  useEffect(() => {
    if (import.meta.env.DEV && currentTrack) {
      console.log('[PLAYER] RECEIVED SONG', {
        id: currentTrack.id,
        name: currentTrack.name || currentTrack.title,
        artists: currentTrack.artists?.primary?.map((artist) => artist?.name).filter(Boolean).join(', ') || currentTrack.artist,
        downloadUrl: currentTrack.downloadUrl,
        audioSource
      })
    }
  }, [audioSource, currentTrack])

  const syncMediaPositionState = useEffectEvent((force = false) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return
    const mediaSession = navigator.mediaSession
    if (typeof mediaSession.setPositionState !== 'function') return

    const now = Date.now()
    if (!force && now - lastMediaPositionUpdateRef.current < 1000) return
    const audio = audioRef.current
    const mediaDuration = Number(audio?.duration)
    const position = Number(audio?.currentTime)
    if (!Number.isFinite(mediaDuration) || mediaDuration <= 0 || !Number.isFinite(position)) return

    lastMediaPositionUpdateRef.current = now
    try {
      mediaSession.setPositionState({
        duration: mediaDuration,
        playbackRate: Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1,
        position: Math.max(0, Math.min(position, mediaDuration)),
      })
    } catch {
      // Position state may be rejected while browser media metadata is changing.
    }
  })

  const handleMediaSessionAction = useEffectEvent(({ action, details }) => {
    if (action === 'play' && !isPlaying) togglePlay()
    if (action === 'pause' && isPlaying) togglePlay()
    if (action === 'previoustrack') previous()
    if (action === 'nexttrack') next()
    if (action === 'seekbackward') seek(Math.max(0, progress - (details.seekOffset || 10)))
    if (action === 'seekforward') seek(Math.min(duration || Infinity, progress + (details.seekOffset || 10)))
    if (action === 'seekto' && Number.isFinite(details.seekTime)) seek(details.seekTime)
  })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined

    const mediaSession = navigator.mediaSession
    if (!currentTrack) {
      mediaSession.metadata = null
      return undefined
    }
    const artwork = getBestImageUrl(currentTrack.image)
    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || currentTrack.name || 'Autumn',
      artist: currentTrack.artist || currentTrack.subtitle || 'Autumn Player',
      album: currentTrack.album || 'Autumn',
      artwork: artwork ? [96, 128, 192, 256, 384, 512].map((size) => ({ src: artwork, sizes: `${size}x${size}`, type: 'image/jpeg' })) : [],
    })
    lastMediaPositionUpdateRef.current = 0

    const actions = {
      play: () => handleMediaSessionAction({ action: 'play', details: {} }),
      pause: () => handleMediaSessionAction({ action: 'pause', details: {} }),
      previoustrack: () => handleMediaSessionAction({ action: 'previoustrack', details: {} }),
      nexttrack: () => handleMediaSessionAction({ action: 'nexttrack', details: {} }),
      seekbackward: (details) => handleMediaSessionAction({ action: 'seekbackward', details }),
      seekforward: (details) => handleMediaSessionAction({ action: 'seekforward', details }),
      seekto: (details) => handleMediaSessionAction({ action: 'seekto', details }),
    }

    Object.entries(actions).forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler)
      } catch {
        // Some browsers expose Media Session without supporting every action.
      }
    })

    return () => {
      Object.keys(actions).forEach((action) => {
        try {
          mediaSession.setActionHandler(action, null)
        } catch {
          // Ignore unsupported action cleanup.
        }
      })
    }
  }, [currentTrack])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const trackId = currentTrack?.id ?? null
    if (trackId !== lastMediaTrackIdRef.current) {
      lastMediaTrackIdRef.current = trackId
      lastMediaPositionUpdateRef.current = 0
      forceMediaPositionUpdateRef.current = true
    }
    navigator.mediaSession.playbackState = isPlaying && currentTrack ? 'playing' : 'paused'
    if (currentTrack && lastMediaPositionUpdateRef.current === 0) forceMediaPositionUpdateRef.current = true
    syncMediaPositionState(forceMediaPositionUpdateRef.current)
    forceMediaPositionUpdateRef.current = false
  }, [currentTrack, duration, isPlaying, mediaPositionRequest, progress])

  return (
    <PlayerContext.Provider value={{ currentTrack, queue, currentIndex, isQueueLoading, listenHistory, likedSongs, isLiked, toggleLike, addToQueue, addTracksToQueue, reorderQueue, listenAgain, addToListenAgain, isNotInterested, markNotInterested, restoreInterest, addToLibrary, removeFromLibrary, userPlaylists, setUserPlaylists, isPlaying, progress, duration, volume, setVolume, isShuffleEnabled, isRepeatEnabled, isQueueOpen, playTrack, togglePlay, stopPlayback, next, previous, seek, toggleShuffle, toggleRepeat, toggleQueue, closeQueue }}>
        {children}
        <audio ref={audioRef} src={audioSource || undefined} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} />
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)