const CACHE_KEY_PREFIXES = ['autumn_home_', 'autumn_library_', 'autumn_quick_picks_']

export const setItemWithCacheEviction = (key, value) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    try {
      const cacheKeys = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const cacheKey = localStorage.key(index)
        if (CACHE_KEY_PREFIXES.some((prefix) => cacheKey?.startsWith(prefix))) cacheKeys.push(cacheKey)
      }
      cacheKeys.forEach((cacheKey) => {
        try {
          localStorage.removeItem(cacheKey)
        } catch {
          // Keep trying other disposable caches when one entry cannot be removed.
        }
      })
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
}