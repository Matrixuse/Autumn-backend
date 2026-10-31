import { useContext, useEffect, useRef, useState } from 'react'
import PlayerContext from './player-context'
import { getBestAudioUrl } from '../utils/mediaQuality'
import {
  configure as configureAudioEngine,
  getAudioElement,
  getState as getAudioEngineState,
  pause as enginePause,
  playIndex as enginePlayIndex,
  playNow as enginePlay,
  previous as enginePrevious,
  seekTo as engineSeekTo,
  setOptions as setAudioEngineOptions,
  setPreferredNext as setAudioEnginePreferredNext,
  setQueue as setAudioEngineQueue,
  stop as engineStop,
  togglePlay as engineTogglePlay
} from '../lib/audioEngine'
import {
  buildUpNextQueue,
  claimRecommendationEventKey,
  getActiveDislikedTrackIds,
  getSongIdentity,
  getUpcomingTrackCount,
  isRecommendationRequestCurrent,
  mergeRecommendationTracks,
  normalizeRecommendationSong,
  resolveQueueSelection,
  shouldRefillRecommendations
} from '../utils/recommendationQueue'
import axiosInstance from '../api/axiosInstance'
import { fetchAccountData, importAccountData, patchAccountData } from '../api/accountData'
import { fetchRecommendationProfile, persistRecommendationEvents } from '../api/recommendations'
import { deleteLikedSong, fetchLikedSongs, importLikedSongs, saveLikedSong } from '../api/likedSongs'
import { getSongById } from '../api/songs'

const HISTORY_LIMIT = 18
const PLAYER_PREFERENCES = {
  gapless: 'autumn_gapless_playback',
  dataSaving: 'autumn_data_saving',
  autoplay: 'autumn_autoplay'
}

const readBooleanPreference = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}
const RECOMMENDATION_EVENT_LIMIT = 500
const UPCOMING_QUEUE_TARGET = 50
const UPCOMING_QUEUE_REFILL_THRESHOLD = 49
const RECOMMENDATION_CACHE_TTL_MS = 5 * 60 * 1000
const SEARCH_HISTORY_KEY = 'autumn_search_history'
const ACCOUNT_DATA_CACHE_PREFIX = 'autumn_account_data:'
const ACCOUNT_DATA_MIGRATION_PREFIX = 'autumn_account_data_imported:'
const ACCOUNT_DATA_PENDING_PREFIX = 'autumn_account_data_pending:'
const LEGACY_ACCOUNT_DATA_IMPORTED_KEY = 'autumn_account_data_legacy_imported_v1'
const LEGACY_LIKED_SONGS_KEY = 'autumn_liked_songs'
const LEGACY_LIKED_SONGS_IMPORTED_KEY = 'autumn_liked_songs_legacy_imported_v1'
const getAccountLikedSongsKey = (userId) => `autumn_liked_songs:${userId}`
const getAccountLikedSongsMigrationKey = (userId) => `autumn_liked_songs_imported:${userId}`
const initialAudioState = getAudioEngineState()

const getRecommendationEventsStorageKey = () => `autumn_recommendation_events:${readLocalUserId() || 'anonymous'}`

const readHistory = () => {
  try {
    const raw = localStorage.getItem('autumn_listen_history')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readStoredLikedSongs = (key) => {
  try {
    const raw = localStorage.getItem(key)
    const songs = raw ? JSON.parse(raw) : []
    return Array.isArray(songs) ? songs : []
  } catch {
    return []
  }
}

const readLikedSongs = (userId = readLocalUserId()) => {
  if (userId) {
    try {
      const accountSongs = localStorage.getItem(getAccountLikedSongsKey(userId))
      if (accountSongs !== null) return readStoredLikedSongs(getAccountLikedSongsKey(userId))
      if (localStorage.getItem(LEGACY_LIKED_SONGS_IMPORTED_KEY) === 'true') return []
    } catch {
      return []
    }
  }
  return readStoredLikedSongs(LEGACY_LIKED_SONGS_KEY)
}

const mergeLikedSongLists = (...lists) => {
  const songs = new Map()
  for (const list of lists) {
    for (const song of Array.isArray(list) ? list : []) {
      if (song?.id != null && String(song.id)) songs.set(String(song.id), song)
    }
  }
  return [...songs.values()]
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

const readRecommendationEvents = () => {
  try {
    const raw = localStorage.getItem(getRecommendationEventsStorageKey())
    const events = raw ? JSON.parse(raw) : []
    return Array.isArray(events) ? events.slice(0, RECOMMENDATION_EVENT_LIMIT) : []
  } catch {
    return []
  }
}

const readLocalUserId = () => {
  try {
    const userId = JSON.parse(localStorage.getItem('autumn_user') || 'null')?.id
    return userId == null ? '' : String(userId)
  } catch {
    return ''
  }
}

const getEmptyAccountData = () => ({
  listenHistory: [],
  userPlaylists: [],
  listenAgain: [],
  notInterested: [],
  preferences: { autoplay: true, gapless: false, dataSaving: false },
  searchHistory: [],
  feedback: []
})

const normalizeAccountData = (data = {}) => {
  const defaults = getEmptyAccountData()
  return {
    ...defaults,
    ...data,
    listenHistory: Array.isArray(data.listenHistory) ? data.listenHistory : defaults.listenHistory,
    userPlaylists: Array.isArray(data.userPlaylists) ? data.userPlaylists : defaults.userPlaylists,
    listenAgain: Array.isArray(data.listenAgain) ? data.listenAgain : defaults.listenAgain,
    notInterested: Array.isArray(data.notInterested) ? data.notInterested.map(String) : defaults.notInterested,
    preferences: { ...defaults.preferences, ...(data.preferences || {}) },
    searchHistory: Array.isArray(data.searchHistory) ? data.searchHistory : defaults.searchHistory,
    feedback: Array.isArray(data.feedback) ? data.feedback : defaults.feedback
  }
}

const getLegacyAccountData = () => normalizeAccountData({
  listenHistory: readHistory(),
  userPlaylists: readUserPlaylists(),
  listenAgain: readStoredList('autumn_listen_again'),
  notInterested: readStoredList('autumn_not_interested').map((item) => String(item?.id || item)),
  preferences: {
    autoplay: readBooleanPreference(PLAYER_PREFERENCES.autoplay, true),
    gapless: readBooleanPreference(PLAYER_PREFERENCES.gapless, false),
    dataSaving: readBooleanPreference(PLAYER_PREFERENCES.dataSaving, false)
  },
  searchHistory: readStoredList(SEARCH_HISTORY_KEY),
  feedback: readStoredList('musious_feedbacks_v1')
})

const readAccountDataCache = (userId) => {
  try {
    const raw = localStorage.getItem(`${ACCOUNT_DATA_CACHE_PREFIX}${userId}`)
    return raw ? normalizeAccountData(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const readPendingAccountChanges = (userId) => {
  try {
    const raw = localStorage.getItem(`${ACCOUNT_DATA_PENDING_PREFIX}${userId}`)
    const changes = raw ? JSON.parse(raw) : {}
    return changes && typeof changes === 'object' && !Array.isArray(changes) ? changes : {}
  } catch {
    return {}
  }
}

const readInitialAccountData = () => {
  const userId = readLocalUserId()
  if (!userId) return getLegacyAccountData()
  const cached = readAccountDataCache(userId)
  if (cached) return cached
  return localStorage.getItem(LEGACY_ACCOUNT_DATA_IMPORTED_KEY) === 'true'
    ? getEmptyAccountData()
    : getLegacyAccountData()
}

const queueAccountDataPatch = (pendingRef, timerRef, userId, isReady, changes) => {
  if (!userId || !isReady) return
  if (pendingRef.current.userId !== userId) pendingRef.current = { userId, changes: {} }
  const pending = pendingRef.current
  const nextChanges = { ...pending.changes, ...changes }
  if (changes.preferences) {
    nextChanges.preferences = { ...(pending.changes.preferences || {}), ...changes.preferences }
  }
  pendingRef.current = { userId, changes: nextChanges }
  try {
    localStorage.setItem(`${ACCOUNT_DATA_PENDING_PREFIX}${userId}`, JSON.stringify(nextChanges))
  } catch {
    // Keep the write queued in memory if local storage is unavailable.
  }
  if (timerRef.current) window.clearTimeout(timerRef.current)
  timerRef.current = window.setTimeout(async () => {
    const request = pendingRef.current
    if (request.userId !== userId || !Object.keys(request.changes).length) return
    try {
      await patchAccountData(request.changes)
      if (pendingRef.current === request) {
        pendingRef.current = { userId, changes: {} }
        localStorage.removeItem(`${ACCOUNT_DATA_PENDING_PREFIX}${userId}`)
      }
    } catch {
      // Keep local changes queued for the next account refresh.
    }
  }, 350)
}

const pushHistory = (history, track) => {
  if (!track || !track.id) return history

  const next = history.filter((entry) => entry && entry.id !== track.id)
  const merged = [{ ...track }, ...next].slice(0, HISTORY_LIMIT)
  return merged
}

export const PlayerProvider = ({ children }) => {
  const [initialAccountData] = useState(readInitialAccountData)
  const [currentTrack, setCurrentTrack] = useState(initialAudioState.currentTrack)
  const [queue, setQueue] = useState(initialAudioState.queue)
  const [isQueueLoading, setIsQueueLoading] = useState(false)
  const [listenHistory, setListenHistory] = useState(() => initialAccountData.listenHistory)
  const [activeLikedUserId, setActiveLikedUserId] = useState(readLocalUserId)
  const [likedSongs, setLikedSongs] = useState(() => readLikedSongs())
  const [likesReady, setLikesReady] = useState(() => !readLocalUserId())
  const [accountDataReady, setAccountDataReady] = useState(() => !readLocalUserId())
  const [userPlaylists, setUserPlaylists] = useState(() => initialAccountData.userPlaylists)
  const [listenAgain, setListenAgain] = useState(() => initialAccountData.listenAgain)
  const [notInterested, setNotInterested] = useState(() => initialAccountData.notInterested)
  const [searchHistory, setSearchHistory] = useState(() => initialAccountData.searchHistory)
  const [feedbackHistory, setFeedbackHistory] = useState(() => initialAccountData.feedback)
  const [recommendationEvents, setRecommendationEvents] = useState(() => readRecommendationEvents())
  const [recommendationProfileReload, setRecommendationProfileReload] = useState(0)
  const [queueRefillRequest, setQueueRefillRequest] = useState(0)
  const [isPlaying, setIsPlaying] = useState(initialAudioState.isPlaying)
  const [progress, setProgress] = useState(initialAudioState.progress)
  const [duration, setDuration] = useState(initialAudioState.duration)
  const [volume, setVolume] = useState(initialAudioState.volume)
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(initialAudioState.shuffle)
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(initialAudioState.repeat === 'one' || initialAudioState.repeat === 'all')
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(() => initialAudioState.autoplay ?? initialAccountData.preferences.autoplay)
  const [isGaplessPlaybackEnabled, setIsGaplessPlaybackEnabled] = useState(() => initialAccountData.preferences.gapless)
  const [isDataSavingEnabled, setIsDataSavingEnabled] = useState(() => initialAccountData.preferences.dataSaving)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(initialAudioState.currentIndex)
  const shuffleEnabledRef = useRef(isShuffleEnabled)
  const repeatModeRef = useRef(initialAudioState.repeat)
  const metadataSyncedRef = useRef(false)
  const recommendationRequestRef = useRef(0)
  const recommendationBufferRef = useRef([])
  const lastRecommendationAttemptRef = useRef('')
  const recommendationCacheRef = useRef(new Map())
  const recommendationProfileUserRef = useRef('')
  const playbackSessionRef = useRef(null)
  const playbackSessionSequenceRef = useRef(0)
  const activeLikedUserRef = useRef(activeLikedUserId)
  const pendingLikedChangesRef = useRef(new Map())
  const pendingAccountChangesRef = useRef({ userId: activeLikedUserId, changes: readPendingAccountChanges(activeLikedUserId) })
  const accountPatchTimerRef = useRef(null)
  const recommendationEventSequenceRef = useRef(0)
  const recordedEventKeysRef = useRef(new Set())
  const shufflePlayedIdsRef = useRef(new Set())
  const recentlySeekedRef = useRef(false)
  const resolvingQueueTrackIdsRef = useRef(new Set())
  const handoffPreparationRef = useRef(null)
  const gaplessPreloadRef = useRef(null)
  const preloadAudioRef = useRef(null)

  const persistLikedSongChange = (songId, song) => {
    const userId = activeLikedUserRef.current
    if (!userId) return
    const change = { userId, songId: String(songId), song }
    const key = `${userId}:${change.songId}`
    pendingLikedChangesRef.current.set(key, change)
    if (!likesReady) return
    const request = song ? saveLikedSong(song) : deleteLikedSong(change.songId)
    request.then(() => {
      if (pendingLikedChangesRef.current.get(key) === change) pendingLikedChangesRef.current.delete(key)
    }).catch(() => {})
  }

  const ensurePlaybackSession = (track) => {
    const trackId = String(track?.id || '')
    if (!trackId) return null
    if (playbackSessionRef.current?.trackId !== trackId) {
      playbackSessionSequenceRef.current += 1
      playbackSessionRef.current = {
        key: `${trackId}:${playbackSessionSequenceRef.current}`,
        trackId,
        started: false,
        progressRecorded: false,
        completionRecorded: false,
        replayCount: 0
      }
    }
    return playbackSessionRef.current
  }

  const recordRecommendationEvent = (track, type, details = {}, onceKey = '') => {
    if (!track?.id) return
    const session = ensurePlaybackSession(track)
    const stableKey = onceKey || (['track_started', 'meaningful_progress', 'track_completed', 'track_skipped']
      .includes(type) ? `${session?.key}:${type}:${track.id}` : '')
    if (stableKey && !claimRecommendationEventKey(recordedEventKeysRef.current, stableKey)) return

    recommendationEventSequenceRef.current += 1
    const eventId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${recommendationEventSequenceRef.current}`
    const event = {
      eventId,
      type,
      trackId: String(track.id),
      track: {
        title: String(track.title || track.name || '').slice(0, 250),
        artist: String(track.artist || track.subtitle || '').slice(0, 250),
        language: String(track.language || track.lang || '').slice(0, 64),
        genres: (Array.isArray(track.genre) ? track.genre : Array.isArray(track.genres) ? track.genres : [])
          .filter((genre) => typeof genre === 'string').slice(0, 20).map((genre) => genre.slice(0, 64))
      },
      occurredAt: new Date().toISOString(),
      ...details
    }
    setRecommendationEvents((events) => [event, ...events].slice(0, RECOMMENDATION_EVENT_LIMIT))
    if (activeLikedUserRef.current) {
      persistRecommendationEvents([event], axiosInstance).catch(() => {})
    }
  }

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem('autumn_listen_history', JSON.stringify(listenHistory))
  }, [activeLikedUserId, listenHistory])

  useEffect(() => {
    try {
      if (activeLikedUserId) return
      localStorage.setItem(PLAYER_PREFERENCES.gapless, String(isGaplessPlaybackEnabled))
      localStorage.setItem(PLAYER_PREFERENCES.dataSaving, String(isDataSavingEnabled))
      localStorage.setItem(PLAYER_PREFERENCES.autoplay, String(isAutoplayEnabled))
    } catch {
      // Playback preferences remain available in memory if storage is unavailable.
    }
  }, [activeLikedUserId, isAutoplayEnabled, isDataSavingEnabled, isGaplessPlaybackEnabled])

  useEffect(() => {
    if (!likesReady) return
    try {
      const storageKey = activeLikedUserId ? getAccountLikedSongsKey(activeLikedUserId) : LEGACY_LIKED_SONGS_KEY
      localStorage.setItem(storageKey, JSON.stringify(likedSongs))
    } catch {
      // The in-memory library remains available if local storage is unavailable.
    }
  }, [activeLikedUserId, likedSongs, likesReady])

  useEffect(() => {
    const userId = activeLikedUserId
    if (!userId) return undefined

    let active = true
    let refreshing = false
    const refreshLikedSongs = async () => {
      if (refreshing) return
      refreshing = true
      try {
        let songs = await fetchLikedSongs()
        const accountMigrationKey = getAccountLikedSongsMigrationKey(userId)
        if (localStorage.getItem(accountMigrationKey) !== 'true') {
          const accountCache = readStoredLikedSongs(getAccountLikedSongsKey(userId))
          const legacySongs = localStorage.getItem(LEGACY_LIKED_SONGS_IMPORTED_KEY) === 'true'
            ? []
            : readStoredLikedSongs(LEGACY_LIKED_SONGS_KEY)
          const songsToImport = mergeLikedSongLists(accountCache, legacySongs)
          if (songsToImport.length) songs = await importLikedSongs(songsToImport)
          localStorage.setItem(accountMigrationKey, 'true')
          localStorage.setItem(LEGACY_LIKED_SONGS_IMPORTED_KEY, 'true')
        }

        const pending = [...pendingLikedChangesRef.current.entries()]
          .filter(([, change]) => change.userId === userId)
        for (const [key, change] of pending) {
          try {
            if (change.song) await saveLikedSong(change.song)
            else await deleteLikedSong(change.songId)
            if (pendingLikedChangesRef.current.get(key) === change) pendingLikedChangesRef.current.delete(key)
          } catch {
            // Keep failed changes queued for the next refresh.
          }
        }
        if (pending.length) songs = await fetchLikedSongs()

        const merged = new Map(songs.map((song) => [String(song.id), song]))
        for (const [, change] of pendingLikedChangesRef.current) {
          if (change.userId !== userId) continue
          if (change.song) merged.set(change.songId, change.song)
          else merged.delete(change.songId)
        }
        if (!active || activeLikedUserRef.current !== userId) return
        setLikedSongs([...merged.values()])
        setLikesReady(true)
      } catch {
        if (active && activeLikedUserRef.current === userId) setLikesReady(true)
      } finally {
        refreshing = false
      }
    }

    const refreshWhenVisible = () => {
      if (!document.hidden) refreshLikedSongs()
    }
    refreshLikedSongs()
    const intervalId = window.setInterval(refreshLikedSongs, 30_000)
    window.addEventListener('focus', refreshLikedSongs)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshLikedSongs)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [activeLikedUserId])

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem('autumn_user_playlists', JSON.stringify(userPlaylists))
  }, [activeLikedUserId, userPlaylists])

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem('autumn_listen_again', JSON.stringify(listenAgain))
  }, [activeLikedUserId, listenAgain])

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem('autumn_not_interested', JSON.stringify(notInterested))
  }, [activeLikedUserId, notInterested])

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory))
  }, [activeLikedUserId, searchHistory])

  useEffect(() => {
    if (!activeLikedUserId) localStorage.setItem('musious_feedbacks_v1', JSON.stringify(feedbackHistory))
  }, [activeLikedUserId, feedbackHistory])

  useEffect(() => {
    const userId = activeLikedUserId
    if (!userId) return undefined
    let active = true
    let refreshing = false

    const refreshAccountData = async () => {
      if (refreshing) return
      refreshing = true
      try {
        let data = normalizeAccountData(await fetchAccountData())
        const migrationKey = `${ACCOUNT_DATA_MIGRATION_PREFIX}${userId}`
        if (localStorage.getItem(migrationKey) !== 'true') {
          const localData = readAccountDataCache(userId)
            || (localStorage.getItem(LEGACY_ACCOUNT_DATA_IMPORTED_KEY) === 'true' ? getEmptyAccountData() : getLegacyAccountData())
          data = normalizeAccountData(await importAccountData(localData))
          localStorage.setItem(migrationKey, 'true')
          localStorage.setItem(LEGACY_ACCOUNT_DATA_IMPORTED_KEY, 'true')
        }

        const pending = pendingAccountChangesRef.current
        if (pending.userId === userId && Object.keys(pending.changes).length) {
          data = normalizeAccountData({
            ...data,
            ...pending.changes,
            preferences: { ...data.preferences, ...(pending.changes.preferences || {}) }
          })
        }
        if (!active || activeLikedUserRef.current !== userId) return
        const updateIfChanged = (setter, value) => setter((current) => (
          JSON.stringify(current) === JSON.stringify(value) ? current : value
        ))
        updateIfChanged(setListenHistory, data.listenHistory)
        updateIfChanged(setUserPlaylists, data.userPlaylists)
        updateIfChanged(setListenAgain, data.listenAgain)
        updateIfChanged(setNotInterested, data.notInterested)
        updateIfChanged(setSearchHistory, data.searchHistory)
        updateIfChanged(setFeedbackHistory, data.feedback)
        updateIfChanged(setIsAutoplayEnabled, data.preferences.autoplay)
        updateIfChanged(setIsGaplessPlaybackEnabled, data.preferences.gapless)
        updateIfChanged(setIsDataSavingEnabled, data.preferences.dataSaving)
        setAccountDataReady(true)
        if (pending.userId === userId && Object.keys(pending.changes).length) {
          queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, userId, true, pending.changes)
        }
      } catch {
        if (active && activeLikedUserRef.current === userId) setAccountDataReady(true)
      } finally {
        refreshing = false
      }
    }

    const refreshWhenVisible = () => {
      if (!document.hidden) refreshAccountData()
    }
    refreshAccountData()
    const intervalId = window.setInterval(refreshAccountData, 30_000)
    window.addEventListener('focus', refreshAccountData)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshAccountData)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [activeLikedUserId])

  useEffect(() => {
    if (!accountDataReady) return
    const data = {
      listenHistory,
      userPlaylists,
      listenAgain,
      notInterested,
      preferences: { autoplay: isAutoplayEnabled, gapless: isGaplessPlaybackEnabled, dataSaving: isDataSavingEnabled },
      searchHistory,
      feedback: feedbackHistory
    }
    try {
      if (activeLikedUserId) localStorage.setItem(`${ACCOUNT_DATA_CACHE_PREFIX}${activeLikedUserId}`, JSON.stringify(data))
    } catch {
      // The server remains the durable copy if browser storage is unavailable.
    }
  }, [activeLikedUserId, accountDataReady, feedbackHistory, isAutoplayEnabled, isDataSavingEnabled, isGaplessPlaybackEnabled, listenAgain, listenHistory, notInterested, searchHistory, userPlaylists])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { listenHistory })
  }, [listenHistory, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { userPlaylists })
  }, [userPlaylists, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { listenAgain })
  }, [listenAgain, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { notInterested })
  }, [notInterested, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { searchHistory })
  }, [searchHistory, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, { feedback: feedbackHistory })
  }, [feedbackHistory, activeLikedUserId, accountDataReady])

  useEffect(() => {
    queueAccountDataPatch(pendingAccountChangesRef, accountPatchTimerRef, activeLikedUserId, accountDataReady, {
      preferences: { autoplay: isAutoplayEnabled, gapless: isGaplessPlaybackEnabled, dataSaving: isDataSavingEnabled }
    })
  }, [activeLikedUserId, accountDataReady, isAutoplayEnabled, isDataSavingEnabled, isGaplessPlaybackEnabled])

  useEffect(() => {
    try {
      localStorage.setItem(getRecommendationEventsStorageKey(), JSON.stringify(recommendationEvents))
    } catch {
      // Recommendations continue to work if browser storage is unavailable.
    }
  }, [recommendationEvents])

  useEffect(() => {
    const userId = readLocalUserId()
    if (!userId) {
      recommendationProfileUserRef.current = ''
      return
    }
    if (recommendationProfileUserRef.current === userId) return
    recommendationProfileUserRef.current = userId

    fetchRecommendationProfile(axiosInstance).then(async (response) => {
      if (recommendationProfileUserRef.current !== userId) return
      const remoteEvents = response.data?.data?.events
      if (!Array.isArray(remoteEvents)) return
      const localEvents = readRecommendationEvents()
      const remoteEventIds = new Set(remoteEvents.map((event) => String(event?.eventId || '')))
      const missingEvents = localEvents.filter((event) => event?.eventId && !remoteEventIds.has(String(event.eventId)))
      for (let index = 0; index < missingEvents.length; index += 50) {
        await persistRecommendationEvents(missingEvents.slice(index, index + 50), axiosInstance)
      }
      setRecommendationEvents((localEvents) => {
        const unique = new Map()
        for (const event of [...remoteEvents, ...localEvents]) {
          if (event?.eventId) unique.set(String(event.eventId), event)
        }
        return [...unique.values()]
          .sort((first, second) => String(second.occurredAt).localeCompare(String(first.occurredAt)))
          .slice(0, RECOMMENDATION_EVENT_LIMIT)
      })
    }).catch(() => {
      if (recommendationProfileUserRef.current === userId) recommendationProfileUserRef.current = ''
    })
  }, [currentTrack, recommendationProfileReload])

  useEffect(() => {
    const handleAuthChange = () => {
      const userId = readLocalUserId()
      if (activeLikedUserRef.current !== userId) {
        activeLikedUserRef.current = userId
        setActiveLikedUserId(userId)
        setLikedSongs(userId ? readLikedSongs(userId) : [])
        setLikesReady(!userId)
        const accountData = userId
          ? readAccountDataCache(userId)
            || (localStorage.getItem(LEGACY_ACCOUNT_DATA_IMPORTED_KEY) === 'true' ? getEmptyAccountData() : getLegacyAccountData())
          : getEmptyAccountData()
        setListenHistory(accountData.listenHistory)
        setUserPlaylists(accountData.userPlaylists)
        setListenAgain(accountData.listenAgain)
        setNotInterested(accountData.notInterested)
        setSearchHistory(accountData.searchHistory)
        setFeedbackHistory(accountData.feedback)
        setIsAutoplayEnabled(accountData.preferences.autoplay)
        setIsGaplessPlaybackEnabled(accountData.preferences.gapless)
        setIsDataSavingEnabled(accountData.preferences.dataSaving)
        setAccountDataReady(!userId)
        pendingAccountChangesRef.current = { userId, changes: userId ? readPendingAccountChanges(userId) : {} }
        if (accountPatchTimerRef.current) window.clearTimeout(accountPatchTimerRef.current)
      }
      recommendationProfileUserRef.current = ''
      recommendationBufferRef.current = []
      recommendationCacheRef.current.clear()
      setRecommendationEvents(readRecommendationEvents())
      setRecommendationProfileReload((count) => count + 1)
    }
    const handleStorageChange = (event) => {
      if (event.key === 'autumn_user') handleAuthChange()
    }
    window.addEventListener('autumn-auth-changed', handleAuthChange)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('autumn-auth-changed', handleAuthChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const selectTrackAudio = (track) => {
    const audio = getBestAudioUrl(track?.downloadUrl) || getBestAudioUrl(track?.audio)
    return audio ? { ...track, audio } : track
  }

  const playTrack = (track, selectedQueue) => {
    if (!track) return
    if (!track.audio && !track.downloadUrl && track.id) {
      const trackId = String(track.id)
      if (resolvingQueueTrackIdsRef.current.has(trackId)) return
      resolvingQueueTrackIdsRef.current.add(trackId)
      getSongById(trackId).then((resolvedTrack) => {
        if (!resolvedTrack) return
        const sourceQueue = Array.isArray(selectedQueue) ? selectedQueue : queue
        const resolvedQueue = sourceQueue.map((queuedTrack) => String(queuedTrack?.id) === trackId ? { ...queuedTrack, ...resolvedTrack } : queuedTrack)
        playTrack({ ...track, ...resolvedTrack }, resolvedQueue)
      }).catch(() => {}).finally(() => resolvingQueueTrackIdsRef.current.delete(trackId))
      return
    }

    const requestedQueue = Array.isArray(selectedQueue)
      ? selectedQueue.map((queuedTrack) => queuedTrack && !queuedTrack.queueSource
        ? { ...queuedTrack, queueSource: 'manual' }
        : queuedTrack)
      : queue
    const selection = resolveQueueSelection(requestedQueue, track)
    const selectedTrack = selectTrackAudio(selection.track)

    if (!selection.shouldRegenerate) {
      recommendationRequestRef.current += 1
      lastRecommendationAttemptRef.current = ''
      setIsQueueLoading(false)
      if (selectedTrack.queueSource === 'recommendation') recordRecommendationEvent(selectedTrack, 'recommendation_selected')
      if (Array.isArray(selectedQueue)) {
        const selectedTracks = selection.queue.map((queuedTrack) => String(queuedTrack?.id) === String(selectedTrack.id) ? selectedTrack : queuedTrack)
        setQueue(selectedTracks)
        setAudioEngineQueue(selectedTracks, selection.currentIndex)
      } else {
        setAudioEngineQueue(queue, selection.currentIndex)
      }
      if (isShuffleEnabled) shufflePlayedIdsRef.current.add(String(selectedTrack.id))
      setCurrentIndex(selection.currentIndex)
      setListenHistory((history) => pushHistory(history, selectedTrack))
      setProgress(0)
      enginePlayIndex(selection.currentIndex)
      return
    }

    recommendationRequestRef.current += 1
    const sourceTrack = selectTrackAudio({ ...normalizeRecommendationSong(selection.track), queueSource: 'seed' })
    const preservedTracks = queue.filter((queuedTrack) => (
      queuedTrack?.queueSource === 'manual' || !queuedTrack?.queueSource
    ) && String(queuedTrack?.id || '') !== String(sourceTrack.id || ''))
    if (isShuffleEnabled) shufflePlayedIdsRef.current = new Set([String(sourceTrack.id)])
    const nextQueue = [sourceTrack, ...preservedTracks]
    setQueue(nextQueue)
    setAudioEngineQueue(nextQueue, 0)
    setCurrentIndex(0)
    setIsQueueLoading(false)
    recommendationBufferRef.current = []
    lastRecommendationAttemptRef.current = ''
    setListenHistory((history) => pushHistory(history, sourceTrack))
    setProgress(0)
    enginePlayIndex(0)
  }

  const togglePlay = () => engineTogglePlay()
  const stopPlayback = () => {
    engineStop()
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
    const wasLiked = likedSongs.some((song) => String(song.id) === String(track.id))
    recordRecommendationEvent(track, wasLiked ? 'track_unliked' : 'track_liked')
    persistLikedSongChange(track.id, wasLiked ? null : { ...track })

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
    nextQueue.splice(insertionIndex, 0, { ...track, queueSource: 'manual' })
    setQueue(nextQueue)
    const nextIndex = nextQueue.findIndex((item) => String(item.id) === String(currentTrack?.id))
    if (nextIndex >= 0) setCurrentIndex(nextIndex)
  }
  const addTracksToQueue = (tracks, playNext = false) => {
    const validTracks = (Array.isArray(tracks) ? tracks : []).filter((track) => track?.id)
    if (!validTracks.length) return

    const additions = validTracks
      .filter((track) => !queue.some((item) => String(item.id) === String(track.id)))
      .map((track) => ({ ...track, queueSource: 'manual' }))
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
    if (item?.id) {
      recordRecommendationEvent(item, 'track_disliked', {}, `feedback:${item.id}`)
      setNotInterested((items) => [...new Set([...items, String(item.id)])])
    }
  }
  const restoreInterest = (item) => {
    if (item?.id) {
      recordedEventKeysRef.current.delete(`feedback:${item.id}`)
      recordRecommendationEvent(item, 'track_undisliked')
      setNotInterested((items) => items.filter((id) => id !== String(item.id)))
    }
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
      persistLikedSongChange(item.id, null)
      return
    }
    setUserPlaylists((items) => items.filter((playlist) => String(playlist.sourceId || playlist.id) !== String(item.id)))
  }
  const next = (manualSkip = true) => {
    let nextIndex
    let nextTrack
    const preloaded = gaplessPreloadRef.current
    if (isGaplessPlaybackEnabled && preloaded && String(queue[preloaded.index]?.id || '') === preloaded.trackId) {
      nextIndex = preloaded.index
      nextTrack = queue[nextIndex]
    } else if (isShuffleEnabled) {
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
    if (isShuffleEnabled) shufflePlayedIdsRef.current.add(String(nextTrack.id))
    if (manualSkip && currentTrack) {
      const actualDuration = Number(audioRef.current?.duration) || Number(duration) || 0
      const actualProgress = Number(audioRef.current?.currentTime) || Number(progress) || 0
      const rapidSkip = !recentlySeekedRef.current && (actualDuration > 0
        ? actualProgress < Math.min(30, actualDuration * 0.25)
        : actualProgress < 20)
      if (rapidSkip) {
        recordRecommendationEvent(currentTrack, 'track_skipped', {
          progressSeconds: actualProgress,
          durationSeconds: actualDuration
        })
      }
    }
    recommendationRequestRef.current += 1
    const selectedTrack = selectTrackAudio(nextTrack)
    const nextQueue = queue.map((queuedTrack, index) => index === nextIndex ? selectedTrack : queuedTrack)
    setAudioEngineQueue(nextQueue, currentIndex)
    setListenHistory((history) => pushHistory(history, selectedTrack))
    enginePlayIndex(nextIndex)
  }
  const previous = () => {
    const previousIndex = currentIndex - 1
    const previousTrack = queue[previousIndex]
    if (!previousTrack) return
    recommendationRequestRef.current += 1
    enginePrevious()
  }
  const seek = (value) => {
    const requestedPosition = Number(value)
    if (!Number.isFinite(requestedPosition)) return
    const position = Math.max(0, Number.isFinite(duration) && duration > 0 ? Math.min(requestedPosition, duration) : requestedPosition)
    recentlySeekedRef.current = true
    setProgress(position)
    engineSeekTo(position)
  }
  const prepareTransferredPlayback = (snapshot, resolvedQueue) => new Promise((resolve) => {
    const tracks = Array.isArray(resolvedQueue) ? resolvedQueue : []
    const index = Math.max(0, Math.min(Number(snapshot.currentIndex) || 0, tracks.length - 1))
    const track = selectTrackAudio(tracks[index] || snapshot.track)
    const transferredTracks = tracks.map((queuedTrack) => String(queuedTrack?.id) === String(track.id) ? track : queuedTrack)
    setQueue(transferredTracks)
      setAudioEngineQueue(transferredTracks, index)
    if (!track?.audio && !track?.downloadUrl) { resolve(false); return }
    if (handoffPreparationRef.current) {
      clearTimeout(handoffPreparationRef.current.timeout)
      handoffPreparationRef.current.resolve(false)
    }
    const timeout = setTimeout(() => {
      if (!handoffPreparationRef.current) return
      handoffPreparationRef.current = null
      resolve(false)
    }, 12000)
    handoffPreparationRef.current = { position: Math.max(0, snapshot.positionMs / 1000), resolve, timeout }
    recommendationRequestRef.current += 1
    setQueue(tracks)
    setAudioEngineQueue(tracks, index)
    enginePlayIndex(index, { shouldPlay: false, position: Math.max(0, snapshot.positionMs / 1000) })
    setProgress(Math.max(0, snapshot.positionMs / 1000))
    setIsPlaying(false)
    setIsShuffleEnabled(Boolean(snapshot.shuffle))
    repeatModeRef.current = snapshot.repeat ? 'one' : 'off'
    setIsRepeatEnabled(Boolean(snapshot.repeat))
    setIsAutoplayEnabled(Boolean(snapshot.autoplay))
  })
  const setPlaybackPaused = (paused) => paused ? enginePause() : enginePlay()
  const pauseForHandoff = () => {
    const position = Number(audioRef.current?.currentTime) || progress || 0
    setProgress(position)
    enginePause()
    return position
  }
  const startPreparedPlayback = async () => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return false
    try {
      await enginePlay()
      return true
    } catch {
      setIsPlaying(false)
      return false
    }
  }
  const handleTimeUpdate = (position, actualDuration, track = currentTrack) => {
    recentlySeekedRef.current = false
    setProgress(Number(position) || 0)
    if (Number(actualDuration) > 0) setDuration(Number(actualDuration))
    const session = ensurePlaybackSession(track)
    if (session?.started && !session.progressRecorded && actualDuration > 0
      && position >= Math.min(30, actualDuration * 0.2)) {
      session.progressRecorded = true
      recordRecommendationEvent(track, 'meaningful_progress', {
        progressSeconds: position,
        durationSeconds: actualDuration
      })
    }
  }
  const handlePlaybackStart = (track = currentTrack) => {
    const session = ensurePlaybackSession(track)
    if (!session || session.started) return
    session.started = true
    recordRecommendationEvent(track, 'track_started')
  }
  const handleLoadedMetadata = (event) => {
    setDuration(Number(event.currentTarget?.duration) || 0)
    if (handoffPreparationRef.current) {
      const preparation = handoffPreparationRef.current
      handoffPreparationRef.current = null
      const position = Math.max(0, Math.min(preparation.position, Number(event.currentTarget?.duration) || preparation.position))
      event.currentTarget.currentTime = position
      setProgress(position)
      clearTimeout(preparation.timeout)
      preparation.resolve(true)
    }
  }
  const handleAudioError = () => {
    const preparation = handoffPreparationRef.current
    if (!preparation) return
    handoffPreparationRef.current = null
    clearTimeout(preparation.timeout)
    preparation.resolve(false)
  }
  const handlePlaybackEnded = (track, position, actualDuration) => {
    const session = ensurePlaybackSession(track)
    if (session && !session.completionRecorded) {
      session.completionRecorded = true
      recordRecommendationEvent(track, 'track_completed', {
        progressSeconds: Number(position) || Number(actualDuration) || 0,
        durationSeconds: Number(actualDuration) || Number(duration) || 0
      })
    }
    if (getAudioEngineState().repeat === 'one' && session) {
      session.replayCount += 1
      recordRecommendationEvent(track, 'track_replayed', {
        progressSeconds: Number(position) || Number(actualDuration) || 0,
        durationSeconds: Number(actualDuration) || Number(duration) || 0
      }, `${session.key}:replay:${session.replayCount}`)
    }
  }
  const toggleShuffle = () => {
    const nextEnabled = !isShuffleEnabled
    shufflePlayedIdsRef.current = nextEnabled && currentTrack?.id
      ? new Set([String(currentTrack.id)])
      : new Set()
    setIsShuffleEnabled(nextEnabled)
  }
  const toggleRepeat = () => {
    const nextEnabled = !isRepeatEnabled
    repeatModeRef.current = nextEnabled ? 'one' : 'off'
    setIsRepeatEnabled(nextEnabled)
  }
  const setAutoplayEnabled = (enabled) => {
    recommendationRequestRef.current += 1
    lastRecommendationAttemptRef.current = ''
    recommendationBufferRef.current = []
    setIsQueueLoading(false)
    setIsAutoplayEnabled(Boolean(enabled))
  }
  const setGaplessPlaybackEnabled = (enabled) => setIsGaplessPlaybackEnabled(Boolean(enabled))
  const setDataSavingEnabled = (enabled) => setIsDataSavingEnabled(Boolean(enabled))
  const toggleQueue = () => setIsQueueOpen((open) => !open)
  const closeQueue = () => setIsQueueOpen(false)
  const audioRef = { current: getAudioElement() }

  useEffect(() => {
    const preloadAudio = preloadAudioRef.current
    if (!preloadAudio) return
    if (!isGaplessPlaybackEnabled || !isAutoplayEnabled || !currentTrack || currentIndex < 0 || !queue.length) {
      gaplessPreloadRef.current = null
      setAudioEnginePreferredNext(-1, '')
      preloadAudio.removeAttribute('src')
      preloadAudio.load()
      return
    }

    let nextIndex = currentIndex + 1
    if (isShuffleEnabled) {
      const candidates = queue.map((track, index) => ({ track, index }))
        .filter(({ track }) => track?.id && !shufflePlayedIdsRef.current.has(String(track.id)))
      if (!candidates.length) {
        gaplessPreloadRef.current = null
        setAudioEnginePreferredNext(-1, '')
        preloadAudio.removeAttribute('src')
        preloadAudio.load()
        return
      }
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)].index
    }

    const nextTrack = queue[nextIndex]
    const audioUrl = nextTrack
      ? getBestAudioUrl(nextTrack.downloadUrl) || getBestAudioUrl(nextTrack.audio)
      : null
    if (!audioUrl || !nextTrack?.id) {
      gaplessPreloadRef.current = null
      setAudioEnginePreferredNext(-1, '')
      preloadAudio.removeAttribute('src')
      preloadAudio.load()
      return
    }

    const trackId = String(nextTrack.id)
    gaplessPreloadRef.current = { index: nextIndex, trackId }
    setAudioEnginePreferredNext(nextIndex, trackId)
    if (preloadAudio.src !== audioUrl) {
      preloadAudio.src = audioUrl
      preloadAudio.load()
    }
  }, [currentIndex, currentTrack, isAutoplayEnabled, isGaplessPlaybackEnabled, isShuffleEnabled, queue])

  useEffect(() => {
    if (!currentTrack?.id) return undefined
    if (!isAutoplayEnabled) {
      recommendationBufferRef.current = []
      lastRecommendationAttemptRef.current = ''
      return undefined
    }

    if (!shouldRefillRecommendations(queue, currentIndex, {
      targetUpcomingCount: UPCOMING_QUEUE_TARGET,
      refillThreshold: UPCOMING_QUEUE_REFILL_THRESHOLD
    }) || isQueueLoading) return undefined

    const attemptKey = `${currentTrack.id}:${queue.length}:${currentIndex}`
    if (lastRecommendationAttemptRef.current === attemptKey) return undefined
    lastRecommendationAttemptRef.current = attemptKey
    const requestId = recommendationRequestRef.current
    const queuedIdentities = new Set(queue.map(getSongIdentity))
    const bufferedCandidates = recommendationBufferRef.current.filter((candidate) => (
      !queuedIdentities.has(getSongIdentity(candidate))
      && !notInterested.some((item) => String(item?.id || item) === String(candidate.id))
    ))

    if (bufferedCandidates.length) {
      const nextQueue = mergeRecommendationTracks(queue, currentIndex, bufferedCandidates, UPCOMING_QUEUE_TARGET)
      const nextIdentities = new Set(nextQueue.map(getSongIdentity))
      recommendationBufferRef.current = bufferedCandidates.filter((candidate) => !nextIdentities.has(getSongIdentity(candidate)))
      if (nextQueue.length > queue.length) setQueue(nextQueue)
      return undefined
    }

    const behaviorHistory = recommendationEvents
      .filter((event) => ['track_started', 'meaningful_progress', 'track_completed', 'track_replayed'].includes(event.type))
      .map((event) => ({ ...event.track, id: event.trackId }))
      .filter((track) => track.title || track.artist)
    const recentIds = new Set([
      ...(listenHistory || []).map((song) => String(song?.id || '')),
      ...recommendationEvents
        .filter((event) => event.type === 'track_started')
        .slice(0, HISTORY_LIMIT)
        .map((event) => String(event.trackId || ''))
    ].filter(Boolean))
    const activeDislikes = getActiveDislikedTrackIds(recommendationEvents)
    const preferenceKey = [
      ...likedSongs.map((song) => String(song?.id || '')),
      ...notInterested.map((id) => String(id)),
      ...activeDislikes,
      ...recommendationEvents.filter((event) => event.type === 'track_skipped').map((event) => String(event.trackId))
    ].sort().join(',')
    const cacheKey = `${getSongIdentity(currentTrack)}:${preferenceKey}`
    const cached = recommendationCacheRef.current.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      const recentIdentities = new Set([...recentIds].map((id) => `id:${id}`))
      const cachedCandidates = cached.candidates.filter((candidate) => (
        !queuedIdentities.has(getSongIdentity(candidate))
        && !recentIdentities.has(getSongIdentity(candidate))
      ))
      const nextQueue = mergeRecommendationTracks(queue, currentIndex, cachedCandidates, UPCOMING_QUEUE_TARGET)
      const nextIdentities = new Set(nextQueue.map(getSongIdentity))
      recommendationBufferRef.current = cachedCandidates.filter((candidate) => !nextIdentities.has(getSongIdentity(candidate)))
      if (nextQueue.length > queue.length) setQueue(nextQueue)
      return undefined
    }

    setIsQueueLoading(true)
    const disinterestedIds = [...new Set([...notInterested.map((id) => String(id)), ...activeDislikes])]
    buildUpNextQueue(currentTrack, axiosInstance, {
      targetUpcomingCount: UPCOMING_QUEUE_TARGET,
      history: [...listenHistory, ...behaviorHistory],
      likedSongs,
      notInterested: disinterestedIds,
      recentIds,
      skipEvents: recommendationEvents.filter((event) => event.type === 'track_skipped'),
      refreshSeed: String(requestId)
    }).then((generatedQueue) => {
      if (!isRecommendationRequestCurrent(requestId, recommendationRequestRef.current, isAutoplayEnabled)) return
      const candidates = generatedQueue.slice(1).filter((candidate) => (
        !notInterested.some((item) => String(item?.id || item) === String(candidate.id))
      ))
      recommendationCacheRef.current.set(cacheKey, {
        expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS,
        candidates
      })
      const initialIdentities = new Set(queue.map(getSongIdentity))
      const usableCandidates = candidates.filter((candidate) => !initialIdentities.has(getSongIdentity(candidate)))
      const needed = Math.max(0, UPCOMING_QUEUE_TARGET - getUpcomingTrackCount(queue, currentIndex))
      const appendedIdentities = new Set(usableCandidates.slice(0, needed).map(getSongIdentity))
      recommendationBufferRef.current = usableCandidates.filter((candidate) => !appendedIdentities.has(getSongIdentity(candidate)))

      setQueue((currentQueue) => {
        const activeIndex = currentQueue.findIndex((track) => String(track.id) === String(currentTrack.id))
        if (activeIndex < 0) return currentQueue
        return mergeRecommendationTracks(currentQueue, activeIndex, candidates, UPCOMING_QUEUE_TARGET)
      })
    }).catch(() => {
      // Recommendation failures must not affect the current track or existing queue.
    }).finally(() => {
      if (isRecommendationRequestCurrent(requestId, recommendationRequestRef.current, isAutoplayEnabled)) setIsQueueLoading(false)
    })

    return undefined
  }, [currentIndex, currentTrack, isAutoplayEnabled, isQueueLoading, likedSongs, listenHistory, notInterested, queueRefillRequest, recommendationEvents, queue])

  useEffect(() => {
    shuffleEnabledRef.current = isShuffleEnabled
  }, [isShuffleEnabled])

  useEffect(() => {
    configureAudioEngine({
      onTrackChanged: (song, index) => {
        const state = getAudioEngineState()
        setQueue(state.queue)
        setCurrentIndex(index)
        setCurrentTrack(song)
        setProgress(state.progress)
        setDuration(state.duration)
        if (shuffleEnabledRef.current && song?.id) shufflePlayedIdsRef.current.add(String(song.id))
        if (song) setListenHistory((history) => pushHistory(history, song))
      },
      onStateChange: (state) => {
        setIsPlaying(state.isPlaying)
        setProgress(state.progress)
        setDuration(state.duration)
      },
      onProgress: handleTimeUpdate,
      onLoadedMetadata: handleLoadedMetadata,
      onPlaybackStart: handlePlaybackStart,
      onPlaybackEnded: handlePlaybackEnded,
      onError: handleAudioError,
      onNeedMore: () => setQueueRefillRequest((count) => count + 1)
    })
    const audio = getAudioElement()
    if (!metadataSyncedRef.current && audio?.readyState >= 1) {
      metadataSyncedRef.current = true
      handleLoadedMetadata({ currentTarget: audio })
    }
  })

  useEffect(() => {
    setAudioEngineQueue(queue, currentIndex)
  }, [currentIndex, queue])

  useEffect(() => {
    setAudioEngineOptions({
      autoplay: isAutoplayEnabled,
      shuffle: isShuffleEnabled,
      repeat: isRepeatEnabled ? (repeatModeRef.current === 'all' ? 'all' : 'one') : 'off',
      volume,
      playedIds: [...shufflePlayedIdsRef.current]
    })
  }, [isAutoplayEnabled, isRepeatEnabled, isShuffleEnabled, volume])

  return (
    <PlayerContext.Provider value={{ currentTrack, queue, currentIndex, isQueueLoading, isAutoplayEnabled, setIsAutoplayEnabled: setAutoplayEnabled, isGaplessPlaybackEnabled, setIsGaplessPlaybackEnabled: setGaplessPlaybackEnabled, isDataSavingEnabled, setIsDataSavingEnabled: setDataSavingEnabled, listenHistory, likedSongs, recommendationEvents, isLiked, toggleLike, addToQueue, addTracksToQueue, reorderQueue, listenAgain, addToListenAgain, isNotInterested, markNotInterested, restoreInterest, addToLibrary, removeFromLibrary, userPlaylists, setUserPlaylists, searchHistory, setSearchHistory, feedbackHistory, setFeedbackHistory, isPlaying, progress, duration, volume, setVolume, isShuffleEnabled, isRepeatEnabled, isQueueOpen, playTrack, togglePlay, stopPlayback, next, previous, seek, toggleShuffle, toggleRepeat, toggleQueue, closeQueue, prepareTransferredPlayback, pauseForHandoff, setPlaybackPaused, startPreparedPlayback }}>
        {children}
        <audio ref={preloadAudioRef} preload="auto" aria-hidden="true" className="hidden" />
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)