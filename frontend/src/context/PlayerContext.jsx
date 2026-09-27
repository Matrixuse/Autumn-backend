import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { CapacitorMusicControls } from 'capacitor-music-controls-plugin-new'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import PlayerContext from './player-context'
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality'
import { buildUpNextQueue, normalizeRecommendationSong, resolveQueueSelection } from '../utils/recommendationQueue'
import axiosInstance from '../api/axiosInstance'
import { AutumnMedia } from '../nativeMedia'

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

const shuffleQueue = (tracks, activeTrack) => {
  const remaining = tracks.filter((track) => track?.id !== activeTrack?.id)
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[remaining[index], remaining[randomIndex]] = [remaining[randomIndex], remaining[index]]
  }
  return activeTrack ? [activeTrack, ...remaining] : remaining
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
  const [volume, setVolume] = useState(1)
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false)
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const recommendationRequestRef = useRef(0)
  const nativeControlsTrackIdRef = useRef(null)
  const nativeControlsQueueRef = useRef(Promise.resolve())
  const isNativePlatform = Capacitor.isNativePlatform()

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

  const playTrack = (track) => {
    if (!track) return

    const selection = resolveQueueSelection(queue, track)

    if (!selection.shouldRegenerate) {
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
    const nextIndex = currentIndex + 1
    const nextTrack = queue[nextIndex]
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
  const getNativePlayerState = useEffectEvent(() => ({ isPlaying, progress }))
  const handleNativeControlsNotification = useEffectEvent(({ message }) => {
    if (message === 'music-controls-play' || message === 'music-controls-pause') togglePlay()
    if (message === 'music-controls-next') next()
    if (message === 'music-controls-previous') previous()
    if (message === 'music-controls-destroy') stopPlayback()
  })
  const seek = (value) => { setProgress(Number(value)); if (audioRef.current) audioRef.current.currentTime = Number(value) }
  const handleTimeUpdate = (event) => setProgress(Number(event.currentTarget?.currentTime) || 0)
  const handleLoadedMetadata = (event) => setDuration(Number(event.currentTarget?.duration) || 0)
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
    setIsShuffleEnabled((enabled) => {
      const nextEnabled = !enabled
      if (nextEnabled && currentTrack && queue.length > 1) {
        const shuffledQueue = shuffleQueue(queue, currentTrack)
        setQueue(shuffledQueue)
        setCurrentIndex(shuffledQueue.findIndex((track) => String(track.id) === String(currentTrack.id)))
      }
      return nextEnabled
    })
  }
  const toggleRepeat = () => setIsRepeatEnabled((enabled) => !enabled)
  const toggleQueue = () => setIsQueueOpen((open) => !open)
  const closeQueue = () => setIsQueueOpen(false)
  const audioSource = currentTrack?.audio || getBestAudioUrl(currentTrack?.downloadUrl)
  const { audioRef } = useAudioPlayer({ src: audioSource, isPlaying, volume, onTimeUpdate: handleTimeUpdate, onEnded: handleEnded })

  useEffect(() => {
    if (!isNativePlatform) return undefined

    let active = true
    const trackId = currentTrack?.id == null ? null : String(currentTrack.id)
    nativeControlsQueueRef.current = nativeControlsQueueRef.current.catch(() => {}).then(async () => {
      try {
        if (!active) return
        if (!trackId) {
          if (nativeControlsTrackIdRef.current) await CapacitorMusicControls.destroy()
          nativeControlsTrackIdRef.current = null
          return
        }

        const permissions = await CapacitorMusicControls.checkPermissions()
        if (permissions.notifications !== 'granted') {
          await CapacitorMusicControls.requestPermissions()
        }
        if (!active) return

        if (nativeControlsTrackIdRef.current) {
          await CapacitorMusicControls.destroy()
          nativeControlsTrackIdRef.current = null
        }

        const title = currentTrack.title || currentTrack.name || 'Autumn'
        const artist = currentTrack.artist || currentTrack.subtitle || 'Autumn Player'
        const album = currentTrack.album || 'Autumn'
        const artwork = getBestImageUrl(currentTrack.image)
        const playerState = getNativePlayerState()

        await CapacitorMusicControls.create({
          track: title,
          artist,
          album,
          cover: artwork,
          duration: duration || Number(currentTrack.duration) || 0,
          elapsed: playerState.progress,
          isPlaying: playerState.isPlaying,
          hasPrev: true,
          hasNext: true,
          hasClose: true
        })
        nativeControlsTrackIdRef.current = trackId
        if (!active) {
          await CapacitorMusicControls.destroy()
          nativeControlsTrackIdRef.current = null
        }
      } catch (error) {
        console.warn('[PLAYER] Unable to update native music controls', error)
      }
    })

    return () => {
      active = false
    }
  }, [currentTrack, duration, isNativePlatform])

  useEffect(() => {
    if (!isNativePlatform || !currentTrack?.id) return
    if (nativeControlsTrackIdRef.current !== String(currentTrack.id)) return

    CapacitorMusicControls.updateIsPlaying({ isPlaying }).catch((error) => {
      console.warn('[PLAYER] Unable to sync native playback state', error)
    })
  }, [currentTrack?.id, isNativePlatform, isPlaying])

  useEffect(() => {
    if (!isNativePlatform) return undefined

    let active = true
    let listener
    CapacitorMusicControls.addListener('controlsNotification', (info) => {
      if (active) handleNativeControlsNotification(info)
    }).then((handle) => {
      if (active) listener = handle
      else handle.remove()
    }).catch((error) => {
      console.warn('[PLAYER] Unable to subscribe to native music controls', error)
    })

    return () => {
      active = false
      listener?.remove()
    }
  }, [isNativePlatform])

  useEffect(() => {
    if (!isNativePlatform) return undefined
    return () => {
      nativeControlsQueueRef.current = nativeControlsQueueRef.current.catch(() => {}).then(async () => {
        if (nativeControlsTrackIdRef.current) await CapacitorMusicControls.destroy()
        nativeControlsTrackIdRef.current = null
      }).catch((error) => {
        console.warn('[PLAYER] Unable to destroy native music controls', error)
      })
    }
  }, [isNativePlatform])

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

  useEffect(() => {
    if (currentTrack?.id) {
      AutumnMedia.updateTrack({
        id: String(currentTrack.id),
        title: currentTrack.title || currentTrack.name || 'Autumn',
        artist: currentTrack.artist || currentTrack.subtitle || 'Autumn Player',
        album: currentTrack.album || 'Autumn',
        artwork: getBestImageUrl(currentTrack.image),
        isPlaying
      })
    } else {
      AutumnMedia.stop()
    }
  }, [currentTrack, isPlaying])

  useEffect(() => {
    let listener
    let active = true

    AutumnMedia.addListener('mediaAction', ({ action }) => {
      if (!active) return
      if (action === 'com.autumn.player.PLAY') setIsPlaying(true)
      if (action === 'com.autumn.player.PAUSE') setIsPlaying(false)
      if (action === 'com.autumn.player.NEXT') next()
      if (action === 'com.autumn.player.PREVIOUS') previous()
      if (action === 'com.autumn.player.STOP') stopPlayback()
    }).then((handle) => {
      listener = handle
    })

    return () => {
      active = false
      listener?.remove()
    }
  }, [currentTrack, queue, isPlaying])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return undefined

    const mediaSession = navigator.mediaSession
    const artwork = getBestImageUrl(currentTrack.image)
    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || currentTrack.name || 'Autumn',
      artist: currentTrack.artist || currentTrack.subtitle || 'Autumn Player',
      album: currentTrack.album || 'Autumn',
      artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : []
    })
    mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

    const actions = {
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      nexttrack: next,
      previoustrack: previous,
      seekbackward: () => seek(Math.max(0, progress - 10)),
      seekforward: () => seek(Math.min(duration || Infinity, progress + 10))
    }

    Object.entries(actions).forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler)
      } catch {
        // Some browsers expose Media Session without supporting every action.
      }
    })

    if (duration > 0 && Number.isFinite(duration) && typeof mediaSession.setPositionState === 'function') {
      mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(progress, duration) })
    }

    return () => {
      Object.keys(actions).forEach((action) => {
        try {
          mediaSession.setActionHandler(action, null)
        } catch {
          // Ignore unsupported action cleanup.
        }
      })
    }
  }, [currentTrack, duration, isPlaying, previous, progress])

  return (
    <PlayerContext.Provider value={{ currentTrack, queue, currentIndex, isQueueLoading, listenHistory, likedSongs, isLiked, toggleLike, addToQueue, addTracksToQueue, reorderQueue, listenAgain, addToListenAgain, isNotInterested, markNotInterested, restoreInterest, addToLibrary, removeFromLibrary, userPlaylists, setUserPlaylists, isPlaying, progress, duration, volume, setVolume, isShuffleEnabled, isRepeatEnabled, isQueueOpen, playTrack, togglePlay, stopPlayback, next, previous, seek, toggleShuffle, toggleRepeat, toggleQueue, closeQueue }}>
        {children}
        <audio ref={audioRef} src={audioSource || undefined} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} />
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)