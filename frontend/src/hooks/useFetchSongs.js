import { useEffect, useEffectEvent, useState } from 'react'
import { getSongs, getQuickPicksSongs, getNewReleaseSongs, getLongToListenSongs, recentGlobalQueries, LIBRARY_ROTATION_MS } from '../api/songs'
import { getRotationBucketKey } from '../utils/dailyRotation'
import { setItemWithCacheEviction } from '../utils/storage'

const getLibraryBucketKey = () => Math.floor(Date.now() / LIBRARY_ROTATION_MS)
const quickPicksRequests = new Map()
const dailySectionRequests = new Map()

const getOrCreateQuickPicksRequest = (key, options) => {
  const activeRequest = quickPicksRequests.get(key)
  if (activeRequest) return activeRequest

  const request = getQuickPicksSongs(options).finally(() => {
    if (quickPicksRequests.get(key) === request) quickPicksRequests.delete(key)
  })
  quickPicksRequests.set(key, request)
  return request
}

const getOrCreateDailySectionRequest = (key, loader) => {
  const activeRequest = dailySectionRequests.get(key)
  if (activeRequest) return activeRequest

  const request = Promise.resolve().then(loader)
  dailySectionRequests.set(key, request)
  return request
}

export const useFetchSongs = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadSongs = async () => {
      const bucketKey = getLibraryBucketKey()
      const cachedKey = `autumn_library_${bucketKey}`
      let cached = null
      try {
        cached = localStorage.getItem(cachedKey)
      } catch {
        cached = null
      }

      if (cached) {
        try {
          setSongs(JSON.parse(cached))
          setLoading(false)
          return
        } catch {
          try {
            localStorage.removeItem(cachedKey)
          } catch {
            // Invalid cache data does not prevent fetching fresh songs.
          }
        }
      }

      setLoading(true)
      setError(null)

      try {
        const results = await getSongs(recentGlobalQueries, 5)
        setSongs(results)
        setItemWithCacheEviction(cachedKey, JSON.stringify(results))
      } catch (err) {
        setError(err)
        setSongs([])
      } finally {
        setLoading(false)
      }
    }

    loadSongs()
  }, [])

  return { songs, setSongs, loading, error }
}

export const useFetchQuickPicks = ({
  history = [],
  moodSongs = [],
  likedSongs = [],
  discoverySongs = [],
  playbackEvents = [],
  currentTrack = null,
  userId = 'anonymous',
  enabled = true
} = {}) => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rotationTimestamp, setRotationTimestamp] = useState(() => Date.now())
  const rotationKey = getRotationBucketKey(userId, 'quick-picks', rotationTimestamp, LIBRARY_ROTATION_MS)

  useEffect(() => {
    let timeoutId
    const scheduleNextBucket = () => {
      const now = Date.now()
      const current = new Date(now)
      const minuteOfDay = current.getHours() * 60 + current.getMinutes()
      const intervalMinutes = LIBRARY_ROTATION_MS / 60000
      const nextBoundaryMinutes = (Math.floor(minuteOfDay / intervalMinutes) + 1) * intervalMinutes
      const nextBoundary = new Date(current)
      if (nextBoundaryMinutes >= 24 * 60) {
        nextBoundary.setDate(nextBoundary.getDate() + 1)
        nextBoundary.setHours(0, 0, 0, 0)
      } else {
        nextBoundary.setHours(Math.floor(nextBoundaryMinutes / 60), nextBoundaryMinutes % 60, 0, 0)
      }
      timeoutId = window.setTimeout(() => {
        setRotationTimestamp(Date.now())
        scheduleNextBucket()
      }, nextBoundary.getTime() - now + 10)
    }
    scheduleNextBucket()
    return () => window.clearTimeout(timeoutId)
  }, [])

  const generateQuickPicks = useEffectEvent(() => getOrCreateQuickPicksRequest(rotationKey, {
    history,
    moodSongs,
    likedSongs,
    discoverySongs,
    playbackEvents,
    currentTrack,
    userId,
    rotationKey
  }))

  useEffect(() => {
    let active = true
    const loadSongs = async () => {
      if (!enabled) return
      const bucketKey = `autumn_quick_picks_v5_${rotationKey}`
      let cached = null
      try {
        cached = localStorage.getItem(bucketKey)
      } catch {
        cached = null
      }

      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed)) {
            if (active) {
              setSongs(parsed.slice(0, 24))
              setLoading(false)
            }
            return
          }
          try { localStorage.removeItem(bucketKey) } catch {}
        } catch {
          try { localStorage.removeItem(bucketKey) } catch {}
        }
      }

      if (active) {
        setLoading(true)
        setError(null)
      }

      try {
        const results = (await generateQuickPicks()).slice(0, 24)
        if (!active) return
        setSongs(results)
        try {
          localStorage.setItem(bucketKey, JSON.stringify(results))
        } catch {
          // A successful selection remains usable when browser storage is unavailable.
        }
      } catch (err) {
        if (!active) return
        setError(err)
        setSongs([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSongs()
    return () => { active = false }
  }, [enabled, rotationKey, userId])

  return { songs, loading, error }
}

export const useFetchNewReleases = (history = []) => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadSongs = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await getOrCreateDailySectionRequest(
          `new-releases-${getLibraryBucketKey()}`,
          () => getNewReleaseSongs(history, 8)
        )
        setSongs(results)
      } catch (err) {
        setError(err)
        setSongs([])
      } finally {
        setLoading(false)
      }
    }

    loadSongs()
  }, [history])

  return { songs, loading, error }
}

export const useFetchLongSongs = (history = []) => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadSongs = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await getOrCreateDailySectionRequest(
          `long-songs-${getLibraryBucketKey()}`,
          () => getLongToListenSongs(history, 24)
        )
        setSongs(results)
      } catch (err) {
        setError(err)
        setSongs([])
      } finally {
        setLoading(false)
      }
    }

    loadSongs()
  }, [history])

  return { songs, loading, error }
}