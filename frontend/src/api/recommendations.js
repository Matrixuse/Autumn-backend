const getResponseSongs = (response) => {
  if (Array.isArray(response.data)) return response.data
  const data = response.data?.data
  if (Array.isArray(data)) return data
  const results = data?.results || response.data?.results || []
  return Array.isArray(results) ? results : []
}

export const fetchRecommendationCandidates = async (track, apiClient, onCandidates) => {
  let candidates = []

  try {
    const response = await apiClient.get(`/songs/${encodeURIComponent(String(track.id))}/suggestions`, {
      params: { limit: 20 }
    })
    candidates = getResponseSongs(response)
  } catch {
    candidates = []
  }
  if (onCandidates?.(candidates, 'suggestions')) return candidates

  if (candidates.length < 10) {
    const primaryArtist = track.artists?.primary?.[0]
    const artist = primaryArtist?.name || primaryArtist?.title || track.primaryArtists || track.artist || track.subtitle || ''
    if (!artist.trim()) return candidates

    try {
      const response = await apiClient.get('/search/songs', {
        params: { query: artist.trim(), page: 0, limit: 20 }
      })
      const artistCandidates = getResponseSongs(response)
      candidates = [...candidates, ...artistCandidates]
      onCandidates?.(artistCandidates, 'artist search')
    } catch {
      if (!candidates.length) return []
    }
  }

  return candidates
}