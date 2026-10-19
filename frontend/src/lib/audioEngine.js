import { getBestImageUrl } from '../utils/mediaQuality'
import { logLifecycle } from './lifecycleLog'

const QUEUE_KEY = 'autumn_player_state_v1'
const POSITION_KEY = 'autumn_player_pos_v1'
const MAX_STATE_AGE = 7 * 24 * 60 * 60 * 1000
const POSITION_WRITE_INTERVAL = 4000
const PRELOAD_NEXT = false

const readStoredJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

const audio = typeof document !== 'undefined' ? document.createElement('audio') : null
if (audio) {
  audio.preload = 'auto'
  audio.setAttribute('aria-hidden', 'true')
  audio.style.display = 'none'
  const attachAudio = () => {
    if (!audio.isConnected) (document.body || document.documentElement).appendChild(audio)
  }
  if (document.body) attachAudio()
  else document.addEventListener('DOMContentLoaded', attachAudio, { once: true })
}

const savedQueueState = readStoredJson(QUEUE_KEY)
const savedPositionState = readStoredJson(POSITION_KEY)
const restoreValid = savedQueueState
  && Date.now() - Number(savedQueueState.savedAt || 0) <= MAX_STATE_AGE
  && Array.isArray(savedQueueState.queue)
  && savedQueueState.queue.every((song) => song?.id)
if (!restoreValid) {
  try {
    localStorage.removeItem(QUEUE_KEY)
    localStorage.removeItem(POSITION_KEY)
  } catch { /* Invalid or expired playback state is discarded silently. */ }
}

let queue = restoreValid
  ? savedQueueState.queue.map((song, index) => ({
    ...song,
    ...(savedQueueState.origin?.queueSources?.[index] ? { queueSource: savedQueueState.origin.queueSources[index] } : {})
  }))
  : []
let currentIndex = restoreValid && Number.isInteger(savedQueueState.currentIndex)
  ? Math.min(Math.max(savedQueueState.currentIndex, -1), queue.length - 1)
  : -1
let shuffle = restoreValid && Boolean(savedQueueState.shuffle)
let repeat = restoreValid ? savedQueueState.repeat || 'off' : 'off'
let autoplay = restoreValid ? savedQueueState.autoplay !== false : true
let volume = restoreValid && Number.isFinite(savedQueueState.volume) ? savedQueueState.volume : 1
let isPlaying = false
let metadataPending = false
let lastPositionWrite = 0
let lastMediaPositionUpdate = 0
let lastQueuePayload = ''
let pendingPosition = restoreValid && savedPositionState
  && Date.now() - Number(savedPositionState.savedAt || 0) <= MAX_STATE_AGE
  ? Math.max(0, Number(savedPositionState.position) || 0)
  : 0
let persistedIsPlaying = Boolean(savedPositionState?.isPlaying)
let onTrackChanged = () => {}
let onStateChange = () => {}
let onProgress = () => {}
let onLoadedMetadata = () => {}
let onPlaybackStart = () => {}
let onPlaybackEnded = () => {}
let onNeedMore = () => {}
let onError = () => {}
let retryCount = 0
let failureHandled = false
let playedIds = new Set(currentIndex >= 0 && queue[currentIndex]?.id ? [String(queue[currentIndex].id)] : [])
let restorePending = Boolean(restoreValid && queue[currentIndex])
let preloadEnabled = PRELOAD_NEXT
let preloadedUrl = null
let preloadedTrackId = null
let activeObjectUrl = null
let preferredNext = null

const getTrackTitle = (song) => song?.title || song?.name || 'Autumn'
const getTrackArtist = (song) => song?.artists?.primary?.map((artist) => artist?.name).filter(Boolean).join(', ')
  || song?.artist || song?.subtitle || 'Autumn Player'
const getTrackAlbum = (song) => song?.album?.name || (typeof song?.album === 'string' ? song.album : '') || 'Autumn'

const audioVariants = (song) => {
  const field = song?.downloadUrl
  const variants = typeof field === 'string'
    ? [{ url: field, quality: 0 }]
    : Array.isArray(field)
      ? field
      : field && typeof field === 'object'
        ? Object.entries(field).map(([key, value]) => typeof value === 'string' ? { url: value, quality: key } : { ...value, quality: value.quality || value.bitrate || key })
        : []
  return variants.map((item) => ({
    url: item?.url || item?.src || item?.link || item?.downloadUrl,
    quality: Number(String(item?.quality || item?.bitrate || item?.kbps || item?.key || '').match(/\d+/)?.[0]) || 0
  })).filter((item) => typeof item.url === 'string' && item.url.trim())
}

const pickUrl = (song) => {
  const variants = audioVariants(song)
  return variants.find((item) => item.quality === 160)?.url
    || variants.find((item) => item.quality === 320)?.url
    || variants[0]?.url
    || song?.audio
    || null
}

const pickAlternateUrl = (song, currentUrl) => audioVariants(song).find((item) => item.url !== currentUrl)?.url || null

const trimSong = (song) => {
  if (!song?.id) return null
  const variants = audioVariants(song).filter((item) => item.quality === 160 || item.quality === 320)
  const downloadUrl = variants.map(({ url, quality }) => ({ url, quality: `${quality}kbps` }))
  const image = getBestImageUrl(song.image)
  return {
    id: song.id,
    name: song.name || song.title || '',
    artists: { primary: (song.artists?.primary || []).filter(Boolean).map((artist) => ({ id: artist.id, name: artist.name })) },
    album: { id: song.album?.id || '', name: getTrackAlbum(song) },
    image: image ? [{ quality: '500x500', url: image }] : [],
    downloadUrl,
    language: song.language || '',
    year: song.year || '',
    duration: song.duration || 0,
    hasLyrics: Boolean(song.hasLyrics),
    playCount: song.playCount || 0
  }
}

const persistQueue = () => {
  const trimmedQueue = queue.map(trimSong).filter(Boolean)
  const state = {
    version: 1,
    queue: trimmedQueue,
    currentIndex,
    shuffle,
    repeat,
    autoplay,
    volume,
    origin: {
      seedTrackId: queue[currentIndex]?.id || null,
      queueSources: queue.map((song) => song?.queueSource || null)
    }
  }
  const signature = JSON.stringify(state)
  if (signature === lastQueuePayload) return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }))
    lastQueuePayload = signature
  } catch {
    // Playback remains available when storage is full or disabled.
  }
}

const writePosition = (force = false) => {
  if (!audio) return
  const now = Date.now()
  if (!force && now - lastPositionWrite < POSITION_WRITE_INTERVAL) return
  lastPositionWrite = now
  persistedIsPlaying = isPlaying
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify({
      savedAt: now,
      position: metadataPending ? pendingPosition : Number.isFinite(audio.currentTime) ? audio.currentTime : pendingPosition,
      isPlaying
    }))
  } catch {
    // Position snapshots are best-effort.
  }
}

const setMediaMetadata = (song) => {
  if (typeof navigator === 'undefined' || !navigator.mediaSession || typeof MediaMetadata === 'undefined') return
  const image = getBestImageUrl(song?.image)
  navigator.mediaSession.metadata = new MediaMetadata({
    title: getTrackTitle(song),
    artist: getTrackArtist(song),
    album: getTrackAlbum(song),
    artwork: image ? [96, 128, 192, 256, 384, 512].map((size) => ({ src: image, sizes: `${size}x${size}`, type: 'image/jpeg' })) : []
  })
}

const updatePositionState = (force = false) => {
  const now = Date.now()
  if (!force && now - lastMediaPositionUpdate < 1000) return
  const mediaSession = typeof navigator !== 'undefined' ? navigator.mediaSession : null
  if (!audio || !mediaSession || typeof mediaSession.setPositionState !== 'function') return
  const duration = Number(audio.duration)
  const position = Number(audio.currentTime)
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return
  try {
    mediaSession.setPositionState({
      duration,
      playbackRate: Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1,
      position: Math.max(0, Math.min(position, duration))
    })
    lastMediaPositionUpdate = now
  } catch {
    // Position state can be rejected while metadata is changing.
  }
}

const setPlaybackState = (playing) => {
  isPlaying = Boolean(playing)
  if (typeof navigator !== 'undefined' && navigator.mediaSession) {
    try { navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused' } catch { /* Unsupported state. */ }
  }
  onStateChange(getState())
  updatePositionState(true)
  writePosition(true)
}

const requestPlay = () => {
  if (!audio || !queue[currentIndex]) return
  let result
  try {
    result = audio.play()
    setPlaybackState(true)
  } catch {
    setPlaybackState(false)
    return Promise.resolve(false)
  }
  return Promise.resolve(result).then(() => true).catch((error) => {
    setPlaybackState(false)
    if (error?.name !== 'NotAllowedError') logLifecycle('audio-play-rejected', { name: error?.name || 'Error' })
    return false
  })
}

const setSource = (song, index, { shouldPlay = true, position = 0, retry = false } = {}) => {
  if (!audio || !song) return
  currentIndex = index
  metadataPending = true
  if (!retry) {
    retryCount = 0
    failureHandled = false
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl)
      activeObjectUrl = null
    }
  }
  if (shuffle && song.id) playedIds.add(String(song.id))
  const id = String(song.id || '')
  const source = preloadedTrackId === id && preloadedUrl ? preloadedUrl : pickUrl(song)
  if (preloadedTrackId === id && preloadedUrl) {
    activeObjectUrl = preloadedUrl
    preloadedUrl = null
    preloadedTrackId = null
  }
  if (!source) {
    metadataPending = false
    setPlaybackState(false)
    onTrackChanged(song, index)
    return
  }
  pendingPosition = Math.max(0, Number(position) || 0)
  restorePending = pendingPosition > 0
  audio.volume = volume
  audio.src = source
  audio.load()
  setMediaMetadata(song)
  if (shouldPlay) requestPlay()
  else setPlaybackState(false)
  persistQueue()
  onTrackChanged(song, index)
  if (queue.length - index - 1 <= 3) onNeedMore()
}

const selectNextIndex = () => {
  if (!queue.length || currentIndex < 0) return -1
  if (preferredNext && String(queue[preferredNext.index]?.id || '') === preferredNext.id) {
    const index = preferredNext.index
    preferredNext = null
    return index
  }
  if (shuffle) {
    let candidates = queue.map((song, index) => ({ song, index }))
      .filter(({ song }) => song?.id && !playedIds.has(String(song.id)))
    if (!candidates.length && repeat === 'all') {
      playedIds = new Set([String(queue[currentIndex]?.id || '')])
      candidates = queue.map((song, index) => ({ song, index }))
        .filter(({ song }) => song?.id && !playedIds.has(String(song.id)))
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].index : -1
  }
  const nextIndex = currentIndex + 1
  if (nextIndex < queue.length) return nextIndex
  return repeat === 'all' ? 0 : -1
}

const advance = ({ shouldPlay = true, failed = false } = {}) => {
  const nextIndex = selectNextIndex()
  if (nextIndex < 0) {
    setPlaybackState(false)
    return
  }
  const nextSong = queue[nextIndex]
  if (shuffle && nextSong?.id) playedIds.add(String(nextSong.id))
  setSource(nextSong, nextIndex, { shouldPlay, position: 0 })
  if (failed) logLifecycle('audio-skip-after-failure', { id: nextSong?.id || null })
}

const retryOrSkip = (reason) => {
  if (!audio || currentIndex < 0) return
  if (failureHandled) {
    if (retryCount > 0) {
      failureHandled = false
      logLifecycle('audio-failure-skip', { reason, id: queue[currentIndex]?.id || null })
      advance({ failed: true })
    }
    return
  }
  const song = queue[currentIndex]
  const alternate = pickAlternateUrl(song, audio.currentSrc || audio.src)
  if (retryCount === 0 && alternate) {
    retryCount = 1
    failureHandled = true
    logLifecycle('audio-retry', { reason, id: song?.id || null })
    audio.src = alternate
    audio.load()
    requestPlay()
    audio.addEventListener('playing', () => { failureHandled = false }, { once: true })
    return
  }
  failureHandled = true
  logLifecycle('audio-failure-skip', { reason, id: song?.id || null })
  advance({ failed: true })
}

const handleEnded = () => {
  const endedSong = queue[currentIndex]
  const duration = Number(audio?.duration) || 0
  const position = Number(audio?.currentTime) || duration
  if (repeat === 'one' || repeat === true) {
    audio.currentTime = 0
    requestPlay()
    onPlaybackEnded(endedSong, position, duration)
    return
  }
  if (autoplay) advance()
  else setPlaybackState(false)
  onPlaybackEnded(endedSong, position, duration)
}

const play = () => {
  const song = queue[currentIndex]
  if (!song || !audio) return
  if (!audio.src) return setSource(song, currentIndex, { shouldPlay: true, position: pendingPosition })
  return requestPlay()
}

export const pause = () => {
  if (audio) audio.pause()
  setPlaybackState(false)
}

const registerMediaSessionHandlers = () => {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return
  const handlers = {
    play,
    pause,
    previoustrack: previous,
    nexttrack: next,
    seekto: (details) => seekTo(details.seekTime),
    seekbackward: (details) => seekTo((Number(audio?.currentTime) || 0) - (details.seekOffset || 10)),
    seekforward: (details) => seekTo((Number(audio?.currentTime) || 0) + (details.seekOffset || 10)),
    stop: () => stop()
  }
  Object.entries(handlers).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* Unsupported action. */ }
  })
}

function previous() {
  preferredNext = null
  if (currentIndex > 0) {
    setSource(queue[currentIndex - 1], currentIndex - 1)
    return
  }
  if (repeat === 'all' && queue.length) setSource(queue[queue.length - 1], queue.length - 1)
}

function next() {
  advance()
}

function seekTo(seconds) {
  if (!audio || !Number.isFinite(Number(seconds))) return
  const duration = Number(audio.duration)
  const requested = Math.max(0, Number(seconds))
  audio.currentTime = Number.isFinite(duration) && duration > 0 ? Math.min(requested, duration) : requested
  pendingPosition = audio.currentTime
  updatePositionState(true)
  writePosition(true)
  onProgress(audio.currentTime, Number.isFinite(duration) ? duration : 0, queue[currentIndex])
}

export function stop() {
  preferredNext = null
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  queue = []
  currentIndex = -1
  pendingPosition = 0
  isPlaying = false
  try {
    localStorage.removeItem(QUEUE_KEY)
    localStorage.removeItem(POSITION_KEY)
  } catch { /* Storage is optional. */ }
  if (typeof navigator !== 'undefined' && navigator.mediaSession) {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'paused'
  }
  onStateChange(getState())
  onTrackChanged(null, -1)
}

const restoreSavedTrack = () => {
  if (!audio || !restoreValid || currentIndex < 0 || !queue[currentIndex]) return
  const song = queue[currentIndex]
  audio.volume = volume
  audio.src = pickUrl(song) || ''
  audio.load()
  setMediaMetadata(song)
  if (typeof navigator !== 'undefined' && navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'
}

export const getState = () => ({
  queue,
  currentIndex,
  currentTrack: queue[currentIndex] || null,
  isPlaying: Boolean(audio && !audio.paused && isPlaying),
  progress: metadataPending ? pendingPosition : audio && Number.isFinite(audio.currentTime) ? audio.currentTime : pendingPosition,
  duration: !metadataPending && audio && Number.isFinite(audio.duration) ? audio.duration : 0,
  shuffle,
  repeat,
  volume,
  autoplay
})

export const setQueue = (songs, startIndex = currentIndex) => {
  const previousIds = new Set(playedIds)
  queue = Array.isArray(songs) ? songs : []
  currentIndex = queue.length && Number.isInteger(startIndex) && startIndex >= 0 && startIndex < queue.length ? startIndex : -1
  playedIds = new Set(queue.filter((song) => previousIds.has(String(song?.id || ''))).map((song) => String(song.id)))
  if (currentIndex >= 0 && queue[currentIndex]?.id) playedIds.add(String(queue[currentIndex].id))
  persistQueue()
}

export const playIndex = (index, options = {}) => {
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return
  preferredNext = null
  setSource(queue[index], index, options)
}

export { next, previous, seekTo }

export const togglePlay = () => {
  if (audio && !audio.paused) pause()
  else play()
}

export const playNow = () => play()

export const setOptions = (options = {}) => {
  if ('shuffle' in options) shuffle = Boolean(options.shuffle)
  if ('repeat' in options) repeat = options.repeat === true ? 'one' : options.repeat || 'off'
  if ('autoplay' in options) autoplay = Boolean(options.autoplay)
  if ('volume' in options && Number.isFinite(Number(options.volume))) {
    volume = Math.max(0, Math.min(1, Number(options.volume)))
    if (audio) audio.volume = volume
  }
  if (Array.isArray(options.playedIds)) playedIds = new Set(options.playedIds.map(String))
  persistQueue()
}

export const setPreferredNext = (index, id) => {
  preferredNext = Number.isInteger(index) && id ? { index, id: String(id) } : null
}

export const configure = (callbacks = {}) => {
  onTrackChanged = callbacks.onTrackChanged || onTrackChanged
  onStateChange = callbacks.onStateChange || onStateChange
  onProgress = callbacks.onProgress || onProgress
  onLoadedMetadata = callbacks.onLoadedMetadata || onLoadedMetadata
  onPlaybackStart = callbacks.onPlaybackStart || onPlaybackStart
  onPlaybackEnded = callbacks.onPlaybackEnded || onPlaybackEnded
  onNeedMore = callbacks.onNeedMore || onNeedMore
  onError = callbacks.onError || onError
}

export const getAudioElement = () => audio

export const recover = () => {
  registerMediaSessionHandlers()
  const song = queue[currentIndex]
  if (song) setMediaMetadata(song)
  if (!audio || !song) return
  const duration = Number(audio.duration)
  if (audio.ended || (persistedIsPlaying && duration > 0 && pendingPosition >= duration - 1)) {
    if (repeat === 'one') {
      setSource(song, currentIndex)
      return
    }
    advance()
    return
  }
  if (audio.paused && persistedIsPlaying && !document.wasDiscarded) requestPlay()
}

export const isPreloadEnabled = () => preloadEnabled

if (audio) {
  audio.volume = volume
  audio.addEventListener('play', () => {
    setPlaybackState(true)
    onPlaybackStart(queue[currentIndex])
  })
  audio.addEventListener('pause', () => setPlaybackState(false))
  audio.addEventListener('ended', handleEnded)
  audio.addEventListener('error', () => {
    onStateChange(getState())
    onError({ currentTarget: audio })
    retryOrSkip(`error:${audio.error?.code || 0}`)
  })
  audio.addEventListener('stalled', () => retryOrSkip('stalled'))
  audio.addEventListener('timeupdate', () => {
    const position = Number(audio.currentTime) || 0
    const duration = Number(audio.duration) || 0
    pendingPosition = position
    onProgress(position, duration, queue[currentIndex])
    updatePositionState()
    writePosition()
    if (preloadEnabled && duration > 0 && duration - position <= 30 && !preloadedUrl) {
      const nextIndex = selectNextIndex()
      const nextSong = queue[nextIndex]
      const nextUrl = nextSong ? pickUrl(nextSong) : null
      if (nextUrl) fetch(nextUrl).then((response) => {
        if (!response.ok) throw new Error('preload failed')
        return response.blob()
      }).then((blob) => {
        preloadedUrl = URL.createObjectURL(blob)
        preloadedTrackId = String(nextSong.id)
      }).catch(() => { preloadEnabled = false })
    }
  })
  audio.addEventListener('loadedmetadata', () => {
    metadataPending = false
    if (restorePending) {
      audio.currentTime = Math.max(0, Math.min(pendingPosition, Number(audio.duration) || pendingPosition))
      restorePending = false
      onTrackChanged(queue[currentIndex], currentIndex)
    }
    updatePositionState(true)
    onLoadedMetadata({ currentTarget: audio })
  })
  for (const event of ['play', 'pause', 'ended', 'error', 'stalled', 'waiting', 'emptied', 'playing']) {
    audio.addEventListener(event, () => logLifecycle(`audio-${event}`, event === 'error' ? { code: audio.error?.code || 0 } : {}))
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writePosition(true)
    else recover()
  })
  window.addEventListener('pagehide', () => writePosition(true))
  window.addEventListener('pageshow', recover)
  document.addEventListener('resume', recover)
  setInterval(() => writePosition(), POSITION_WRITE_INTERVAL)
  registerMediaSessionHandlers()
  restoreSavedTrack()
}