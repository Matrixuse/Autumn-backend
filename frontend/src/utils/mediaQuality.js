const usableUrl = (value) => typeof value === 'string' && value.trim() ? value : null

const collectImageCandidates = (value, candidates = []) => {
  if (!value) return candidates

  if (typeof value === 'string') {
    const url = usableUrl(value)
    if (url) candidates.push(url)
    return candidates
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectImageCandidates(entry, candidates))
    return candidates
  }

  if (typeof value === 'object') {
    const direct = value.url || value.src || value.link || value.image || value.thumbnail || value.cover || value.artwork || value.default || value.webp
    if (direct) collectImageCandidates(direct, candidates)

    Object.values(value).forEach((entry) => collectImageCandidates(entry, candidates))
  }

  return candidates
}

const entriesFrom = (field) => {
  if (typeof field === 'string') return [{ url: field }]
  if (Array.isArray(field)) return field.filter((item) => item && typeof item === 'object')
  if (field && typeof field === 'object') return Object.entries(field).map(([key, value]) => typeof value === 'string' ? { url: value, key } : { ...value, key })
  return []
}

const normalizedNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0

  const match = value.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

const numericValue = (item, keys) => {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) {
      const parsed = normalizedNumber(value)
      if (parsed > 0) return parsed
    }
  }

  const text = Object.values(item || {}).map((value) => String(value ?? '')).join(' ')
  const parsed = normalizedNumber(text)
  return parsed || 0
}

/** Returns the highest bitrate URL from a string, keyed object, or variant array. */
export const getBestAudioUrl = (audioField) => entriesFrom(audioField)
  .map((item) => ({
    url: usableUrl(item.url || item.src || item.link || item.downloadUrl),
    score: numericValue(item, ['bitrate', 'kbps', 'quality', 'size'])
  }))
  .filter((item) => item.url)
  .sort((a, b) => b.score - a.score)[0]?.url || null

export const getDataSavingAudioUrl = (audioField) => {
  const variants = entriesFrom(audioField)
    .map((item) => ({
      url: usableUrl(item.url || item.src || item.link || item.downloadUrl),
      score: normalizedNumber(item.bitrate ?? item.kbps ?? item.quality ?? item.key)
    }))
    .filter((item) => item.url)
  const knownBitrates = variants.filter((item) => item.score > 0).sort((first, second) => first.score - second.score)
  return knownBitrates[0]?.url || variants[0]?.url || getBestAudioUrl(audioField)
}

/** Returns the largest image URL from a string, keyed object, or variant array. */
export const getBestImageUrl = (imageField) => {
  const candidates = collectImageCandidates(imageField)

  if (!candidates.length) return null

  const scored = candidates
    .map((url) => {
      const value = String(url || '').trim()
      if (!value) return null

      const widthBoost = /(?:\d{3,}x\d{3,}|\d{3,}x\d{2,})/i.test(value) ? 50000 : 0
      const qualityBoost = /\b(640|480|500|720|1080)\b/i.test(value) ? 20000 : 0
      return { url: value, score: widthBoost + qualityBoost }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.url || candidates[0] || null
}