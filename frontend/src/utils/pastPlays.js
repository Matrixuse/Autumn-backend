const DAY_MS = 24 * 60 * 60 * 1000
export const PAST_PLAYS_TARGET = 24
export const PAST_PLAYS_MIN_HISTORY = 5
export const PAST_PLAYS_INACTIVE_DAYS = 7
export const PAST_PLAYS_COOLDOWN_DAYS = 7

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const normalizeTrackId = (value) => String(value ?? '').trim()
const normalizeArtistName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const toDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const toLocalDateKey = (date) => {
  const safe = toDate(date) || new Date()
  const year = safe.getFullYear()
  const month = String(safe.getMonth() + 1).padStart(2, '0')
  const day = String(safe.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getPastPlaysSnapshotKey = (userId, date = new Date()) => `autumn_past_plays:${String(userId || 'anonymous')}:${toLocalDateKey(date)}`

const readSnapshotFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && Array.isArray(parsed.songs) ? parsed : null
  } catch {
    return null
  }
}

const writeSnapshotToStorage = (key, snapshot) => {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    // Snapshot generation should not crash the app when storage is unavailable.
  }
}

const shuffleOnce = (items) => {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

const getSongDescriptor = (song = {}) => ({
  id: normalizeTrackId(song?.id || song?.trackId || ''),
  title: String(song?.title || song?.name || 'Unknown track').slice(0, 200),
  artist: normalizeArtistName(song?.artist || song?.subtitle || song?.primaryArtists || 'Unknown artist').slice(0, 200),
  image: song?.image || song?.imageUrl || song?.cover || '',
  audio: song?.audio || '',
  ...song
})

const readTrackEventCounts = (trackId, events, now) => {
  const trackEvents = (Array.isArray(events) ? events : []).filter((event) => normalizeTrackId(event?.trackId || '') === normalizeTrackId(trackId))
  const summary = {
    id: normalizeTrackId(trackId),
    totalStarted: 0,
    totalCompleted: 0,
    recent7: 0,
    recent14: 0,
    recent30: 0,
    skipped: 0,
    replays: 0,
    lastPlayedAt: null,
    lastPlayedAtMs: 0,
    meaningfulProgress: 0
  }

  trackEvents.forEach((event) => {
    const occurredAt = toDate(event?.occurredAt)
    if (!occurredAt) return
    const timestamp = occurredAt.getTime()
    const type = event?.type
    if (type === 'track_started' || type === 'meaningful_progress') summary.totalStarted += 1
    if (type === 'track_completed') summary.totalCompleted += 1
    if (type === 'track_skipped') summary.skipped += 1
    if (type === 'track_replayed') summary.replays += 1
    if (type === 'meaningful_progress') summary.meaningfulProgress += 1

    if (!summary.lastPlayedAt || timestamp > summary.lastPlayedAtMs) {
      summary.lastPlayedAt = occurredAt
      summary.lastPlayedAtMs = timestamp
    }

    if (now.getTime() - timestamp <= 7 * DAY_MS) summary.recent7 += 1
    if (now.getTime() - timestamp <= 14 * DAY_MS) summary.recent14 += 1
    if (now.getTime() - timestamp <= 30 * DAY_MS) summary.recent30 += 1
  })

  return summary
}

const getTrackSummary = ({ song, events, now }) => {
  const id = normalizeTrackId(song?.id || song?.trackId || '')
  if (!id) return null

  const eventSummary = readTrackEventCounts(id, events, now)
  const recent7 = eventSummary.recent7
  const recent14 = eventSummary.recent14
  const recent30 = eventSummary.recent30
  const totalStarted = Math.max(eventSummary.totalStarted, eventSummary.totalCompleted, eventSummary.replays)
  const startedOrCompleted = Math.max(totalStarted, 1)
  const completionRate = totalStarted > 0 ? eventSummary.totalCompleted / startedOrCompleted : 0
  const skipRate = totalStarted > 0 ? eventSummary.skipped / startedOrCompleted : 0
  const lastPlayedAt = eventSummary.lastPlayedAt || toDate(song?.lastPlayedAt) || toDate(song?.playedAt)
  const daysSinceLastPlay = lastPlayedAt ? (now.getTime() - lastPlayedAt.getTime()) / DAY_MS : Number.POSITIVE_INFINITY

  return {
    id,
    song: getSongDescriptor(song),
    eventSummary,
    totalStarted,
    recent7,
    recent14,
    recent30,
    completionRate,
    skipRate,
    daysSinceLastPlay,
    lastPlayedAt
  }
}

export const derivePastPlaysCandidates = ({ userId, listenHistory = [], recommendationEvents = [], now = new Date(), target = PAST_PLAYS_TARGET }) => {
  const userKey = String(userId || 'anonymous')
  const trackMap = new Map()

  ;(Array.isArray(listenHistory) ? listenHistory : []).forEach((song) => {
    const id = normalizeTrackId(song?.id || song?.trackId || '')
    if (!id) return
    if (!trackMap.has(id)) {
      trackMap.set(id, {
        id,
        song: getSongDescriptor(song),
        lastSeenAt: toDate(song?.lastPlayedAt || song?.playedAt) || null
      })
    }
  })

  ;(Array.isArray(recommendationEvents) ? recommendationEvents : []).forEach((event) => {
    const id = normalizeTrackId(event?.trackId || '')
    if (!id) return
    const previous = trackMap.get(id) || { id, song: getSongDescriptor(event?.track) }
    const descriptor = getSongDescriptor(event?.track)
    previous.song = {
      ...descriptor,
      ...previous.song,
      id: previous.song?.id || descriptor.id || id,
      title: previous.song?.title || descriptor.title || 'Unknown track',
      artist: previous.song?.artist || descriptor.artist || 'Unknown artist'
    }
    trackMap.set(id, previous)
  })

  const candidates = []
  for (const [trackId, entry] of trackMap.entries()) {
    const summary = getTrackSummary({ song: entry.song, events: recommendationEvents, now })
    if (!summary || summary.id !== trackId) continue

    const validHistory = Math.max(summary.totalStarted, summary.eventSummary.totalCompleted, summary.eventSummary.replays)
    if (validHistory < PAST_PLAYS_MIN_HISTORY) continue
    if (!Number.isFinite(summary.daysSinceLastPlay) || summary.daysSinceLastPlay < PAST_PLAYS_INACTIVE_DAYS) continue
    if (summary.recent7 > Math.max(1, Math.round(summary.totalStarted * 0.4))) continue

    const historicalAffinity = clamp((summary.totalStarted / 12) * 35 + (summary.completionRate * 35) * 100 + (summary.eventSummary.replays * 8) + (summary.eventSummary.meaningfulProgress * 6), 0, 100)
    const dormancy = clamp((summary.daysSinceLastPlay / 60) * 100 + ((summary.recent30 === 0) ? 20 : 0), 0, 100)
    const currentDisinterest = clamp((summary.totalStarted > 0 ? ((summary.totalStarted - summary.recent30) / summary.totalStarted) * 100 : 0) + (summary.skipRate * 40) + ((summary.completionRate < 0.5) ? 10 : 0) + (summary.daysSinceLastPlay >= 30 ? 12 : 0), 0, 100)
    const score = 0.45 * historicalAffinity + 0.3 * dormancy + 0.25 * currentDisinterest

    candidates.push({
      id: summary.id,
      song: { ...summary.song },
      score: Number(score.toFixed(2)),
      historicalAffinity: Number(historicalAffinity.toFixed(2)),
      dormancy: Number(dormancy.toFixed(2)),
      currentDisinterest: Number(currentDisinterest.toFixed(2)),
      reasonCodes: ['historical_affinity', 'dormancy', 'recent_decline'],
      userId: userKey,
      lastPlayedAt: summary.lastPlayedAt ? summary.lastPlayedAt.toISOString() : null
    })
  }

  const byScore = [...candidates].sort((first, second) => second.score - first.score)
  const final = []
  const artistCounts = new Map()
  for (const candidate of byScore) {
    const artistKey = normalizeArtistName(candidate.song?.artist || '')
    if (artistKey && artistCounts.get(artistKey) >= 3) continue
    if (artistKey) artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1)
    final.push(candidate)
    if (final.length >= target) break
  }

  return final
}

export const createPastPlaysSnapshot = ({ user, listenHistory = [], recommendationEvents = [], now = new Date(), target = PAST_PLAYS_TARGET } = {}) => {
  const userId = String(user?.id || 'anonymous')
  const cacheKey = getPastPlaysSnapshotKey(userId, now)
  const cached = readSnapshotFromStorage(cacheKey)
  if (cached) return cached.songs

  const candidates = derivePastPlaysCandidates({ userId, listenHistory, recommendationEvents, now, target })
  const final = shuffleOnce(candidates).slice(0, target)
  const snapshot = { dateKey: toLocalDateKey(now), generatedAt: now.toISOString(), version: 'past-plays-v1', songs: final.map((candidate) => candidate.song) }
  writeSnapshotToStorage(cacheKey, snapshot)
  return snapshot.songs
}

export const getPastPlaysSnapshot = ({ user, listenHistory = [], recommendationEvents = [], now = new Date(), target = PAST_PLAYS_TARGET } = {}) => {
  const userId = String(user?.id || 'anonymous')
  const cacheKey = getPastPlaysSnapshotKey(userId, now)
  const cached = readSnapshotFromStorage(cacheKey)
  if (cached) return cached.songs
  return createPastPlaysSnapshot({ user, listenHistory, recommendationEvents, now, target })
}
