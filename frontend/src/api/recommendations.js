const getResponseSongs = (response) => {
  if (Array.isArray(response.data)) return response.data
  const data = response.data?.data
  if (Array.isArray(data)) return data
  return data?.results || response.data?.results || []
}

export const fetchRecommendationCandidates = async (track, apiClient) => {
  let candidates = []

  try {
    const response = await apiClient.get(`/songs/${encodeURIComponent(String(track.id))}/suggestions`, {
      params: { limit: 20 }
    })
    candidates = getResponseSongs(response)
  } catch {
    candidates = []
  }

  if (candidates.length < 10) {
    const primaryArtist = track.artists?.primary?.[0]
    const artist = primaryArtist?.name || primaryArtist?.title || track.primaryArtists || track.artist || track.subtitle || ''
    if (!artist.trim()) return candidates

    try {
      const response = await apiClient.get('/search/songs', {
        params: { query: artist.trim(), page: 0, limit: 20 }
      })
      candidates = [...candidates, ...getResponseSongs(response)]
    } catch {
      if (!candidates.length) return []
    }
  }

  return candidates
}