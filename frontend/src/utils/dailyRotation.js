const getLocalDayKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const SIX_HOUR_ROTATION_MS = 6 * 60 * 60 * 1000

export const getRotationBucketKey = (userId = 'anonymous', scope = 'home', timestamp = Date.now(), intervalMs = SIX_HOUR_ROTATION_MS) => {
  const interval = Math.max(1, Number(intervalMs) || SIX_HOUR_ROTATION_MS)
  const date = new Date(Number(timestamp))
  const minuteOfDay = date.getHours() * 60 + date.getMinutes()
  const bucket = Math.floor(minuteOfDay / (interval / 60000))
  return `${String(userId || 'anonymous')}:${String(scope || 'home')}:${getLocalDayKey(date)}:${bucket}`
}

const hashSeed = (value) => {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const createDailyRandom = (seed) => {
  let state = hashSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export const getDailyRotationKey = (userId = 'anonymous', scope = 'home', date = new Date()) => (
  `${getLocalDayKey(date)}:${String(userId || 'anonymous')}:${String(scope || 'home')}`
)

export const shuffleForDailyRotation = (items = [], { userId = 'anonymous', scope = 'home', date = new Date() } = {}) => {
  const shuffled = Array.isArray(items) ? [...items] : []
  const random = createDailyRandom(getDailyRotationKey(userId, scope, date))
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]]
  }
  return shuffled
}
