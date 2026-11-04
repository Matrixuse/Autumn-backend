export const setItemWithCacheEviction = (key, value) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    try {
      const cacheKeys = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const cacheKey = localStorage.key(index)
        if (cacheKey?.startsWith('autumn_home_')) cacheKeys.push(cacheKey)
      }
      cacheKeys.forEach((cacheKey) => localStorage.removeItem(cacheKey))
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
}