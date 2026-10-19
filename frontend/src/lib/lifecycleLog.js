const STORAGE_KEY = 'autumn_lifecycle_log'
const MAX_ENTRIES = 150

const readEntries = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : []
  } catch {
    return []
  }
}

let entries = typeof localStorage === 'undefined' ? [] : readEntries()

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Diagnostics must never interfere with playback.
  }
}

export const logLifecycle = (event, details = {}) => {
  entries.push({ timestamp: new Date().toISOString(), event, ...details })
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  persist()
}

export const getLifecycleLog = () => JSON.stringify(entries, null, 2)

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__autumnLog = getLifecycleLog
  logLifecycle('boot', {
    wasDiscarded: Boolean(document.wasDiscarded),
    navigationType: performance.getEntriesByType('navigation')[0]?.type || null
  })

  document.addEventListener('visibilitychange', () => {
    logLifecycle('visibilitychange', { visibilityState: document.visibilityState })
  })
  window.addEventListener('pagehide', (event) => logLifecycle('pagehide', { persisted: event.persisted }))
  window.addEventListener('pageshow', (event) => logLifecycle('pageshow', { persisted: event.persisted }))
  document.addEventListener('freeze', () => logLifecycle('freeze'))
  document.addEventListener('resume', () => logLifecycle('resume'))
  window.addEventListener('online', () => logLifecycle('online'))
  window.addEventListener('offline', () => logLifecycle('offline'))
}