import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'

const PlayerContext = createContext(null)
const STORAGE_KEYS = {
  history: 'autumn_listen_history',
  liked: 'autumn_liked_songs',
  playlists: 'autumn_user_playlists',
}
const HISTORY_LIMIT = 18

const readStored = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const addToHistory = (history, track) => [track, ...history.filter((item) => String(item.id) !== String(track.id))].slice(0, HISTORY_LIMIT)

export function PlayerProvider({ children }) {
  const player = useAudioPlayer(null, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [listenHistory, setListenHistory] = useState([])
  const [likedSongs, setLikedSongs] = useState([])
  const [userPlaylists, setUserPlaylists] = useState([])
  const [isShuffleEnabled, setShuffleEnabled] = useState(false)
  const [isRepeatEnabled, setRepeatEnabled] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {})
    Promise.all(Object.entries(STORAGE_KEYS).map(async ([stateKey, storageKey]) => {
      const value = await readStored(storageKey)
      if (stateKey === 'history') setListenHistory(value)
      if (stateKey === 'liked') setLikedSongs(value)
      if (stateKey === 'playlists') setUserPlaylists(value)
    })).finally(() => setIsHydrated(true))
  }, [])

  useEffect(() => {
    player.loop = isRepeatEnabled
  }, [isRepeatEnabled, player])

  useEffect(() => {
    if (!isHydrated) return
    AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(listenHistory)).catch(() => {})
  }, [isHydrated, listenHistory])

  useEffect(() => {
    if (!isHydrated) return
    AsyncStorage.setItem(STORAGE_KEYS.liked, JSON.stringify(likedSongs)).catch(() => {})
  }, [isHydrated, likedSongs])

  useEffect(() => {
    if (!isHydrated) return
    AsyncStorage.setItem(STORAGE_KEYS.playlists, JSON.stringify(userPlaylists)).catch(() => {})
  }, [isHydrated, userPlaylists])

  const playTrack = (track, sourceQueue = queue) => {
    if (!track?.audio) return
    const normalizedQueue = Array.isArray(sourceQueue) ? sourceQueue.filter((item) => item?.id && item?.audio) : []
    const matchingIndex = normalizedQueue.findIndex((item) => String(item.id) === String(track.id))
    const nextQueue = matchingIndex >= 0 ? normalizedQueue : [track, ...normalizedQueue]
    const nextIndex = matchingIndex >= 0 ? matchingIndex : 0
    const selectedTrack = nextQueue[nextIndex]
    setQueue(nextQueue)
    setCurrentIndex(nextIndex)
    setCurrentTrack(selectedTrack)
    setListenHistory((history) => addToHistory(history, selectedTrack))
    player.replace(selectedTrack.audio)
    player.play()
  }

  const playQueueIndex = (index) => {
    const track = queue[index]
    if (track) playTrack(track, queue)
  }

  const playNext = () => {
    if (!queue.length) return
    const candidates = queue.map((_, index) => index).filter((index) => index !== currentIndex)
    if (!candidates.length) return
    const nextIndex = isShuffleEnabled
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : (currentIndex + 1) % queue.length
    playQueueIndex(nextIndex)
  }

  useEffect(() => {
    if (status.didJustFinish && !isRepeatEnabled) playNext()
  }, [isRepeatEnabled, status.didJustFinish, currentIndex, isShuffleEnabled, queue])

  const playPrevious = () => {
    if (status.currentTime > 3) {
      player.seekTo(0)
      return
    }
    if (queue.length) playQueueIndex((currentIndex - 1 + queue.length) % queue.length)
  }

  const togglePlayback = () => {
    if (status.playing) player.pause()
    else if (currentTrack) player.play()
  }

  const stopPlayback = () => {
    player.pause()
    player.seekTo(0)
    setCurrentTrack(null)
    setQueue([])
    setCurrentIndex(-1)
  }

  const toggleLike = (track) => {
    if (!track?.id) return
    setLikedSongs((songs) => songs.some((song) => String(song.id) === String(track.id))
      ? songs.filter((song) => String(song.id) !== String(track.id))
      : [{ ...track }, ...songs])
  }

  const isLiked = (id) => likedSongs.some((song) => String(song.id) === String(id))

  const addToQueue = (track, playNext = false) => {
    if (!track?.id || queue.some((item) => String(item.id) === String(track.id))) return
    const activeIndex = queue.findIndex((item) => String(item.id) === String(currentTrack?.id))
    const insertAt = playNext && activeIndex >= 0 ? activeIndex + 1 : queue.length
    const nextQueue = [...queue]
    nextQueue.splice(insertAt, 0, track)
    setQueue(nextQueue)
  }

  const value = useMemo(() => ({
    currentTrack,
    queue,
    currentIndex,
    listenHistory,
    likedSongs,
    userPlaylists,
    isPlaying: status.playing,
    progress: status.currentTime,
    duration: status.duration,
    isShuffleEnabled,
    isRepeatEnabled,
    playTrack,
    playQueueIndex,
    playNext,
    playPrevious,
    togglePlayback,
    stopPlayback,
    seekTo: (seconds) => player.seekTo(seconds),
    toggleLike,
    isLiked,
    addToQueue,
    setUserPlaylists,
    setShuffleEnabled,
    setRepeatEnabled,
  }), [
    currentIndex,
    currentTrack,
    isRepeatEnabled,
    isShuffleEnabled,
    listenHistory,
    likedSongs,
    player,
    queue,
    status,
    userPlaylists,
  ])

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used inside PlayerProvider')
  return context
}