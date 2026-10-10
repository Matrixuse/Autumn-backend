import { useEffect, useState } from 'react'
import axiosInstance from '../api/axiosInstance'
import { searchAlbums } from '../api/albums'
import { fetchRecommendationCandidates } from '../api/recommendations'
import { getBestImageUrl } from '../utils/mediaQuality'

const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const getTrackArtists = (track = {}) => [
  track.artists?.primary,
  track.artists?.all,
  track.artists?.featured
]
  .flatMap((artists) => Array.isArray(artists) ? artists : [])
  .map((artist) => artist?.name || artist?.title)
  .filter(Boolean)

const getTrackArtist = (track = {}) => (
  getTrackArtists(track)[0]
  || String(track.artist || track.primaryArtists || track.subtitle || '').split(',')[0].trim()
)

const getTrackArtistId = (track = {}) => {
  const primaryArtist = track.artists?.primary?.[0]
  const allArtist = track.artists?.all?.[0]
  return primaryArtist?.id || allArtist?.id || ''
}

const getTrackAlbum = (track = {}) => (
  typeof track.album === 'object'
    ? track.album
    : { name: track.album || track.more_info?.album || '' }
)

const filterRelatedAlbums = (albums, currentAlbum) => {
  const currentAlbumId = String(currentAlbum.id || currentAlbum._id || '')
  const currentAlbumName = normalizeText(currentAlbum.name || currentAlbum.title)
  const uniqueAlbums = new Set()
  return albums
    .filter((album) => {
      const id = String(album.id || album._id || '')
      const name = normalizeText(album.name || album.title)
      if ((currentAlbumId && id === currentAlbumId) || (currentAlbumName && name === currentAlbumName)) return false
      const key = id || name
      if (!key || uniqueAlbums.has(key)) return false
      uniqueAlbums.add(key)
      return true
    })
    .slice(0, 8)
}

const normalizeArtistAlbum = (album) => ({
  ...album,
  name: album.name || album.title || 'Album',
  image: getBestImageUrl(album.image || album.images || [])
})

export default function useRelatedTrackDetails(track) {
  const [details, setDetails] = useState({ key: '', artists: [], albums: [] })

  useEffect(() => {
    if (!track?.id) return undefined

    const controller = new AbortController()
    const trackTitle = track.title || track.name || ''
    const trackArtist = getTrackArtist(track)
    const album = getTrackAlbum(track)
    const trackKey = JSON.stringify([
      track.id,
      trackTitle,
      trackArtist,
      album.id || album._id || '',
      album.name || album.title || ''
    ])
    const artistNames = new Set([
      ...getTrackArtists(track),
      ...String(track.artist || track.primaryArtists || track.subtitle || '').split(',')
    ].map(normalizeText).filter(Boolean))
    const artistId = getTrackArtistId(track)
    const artistName = getTrackArtist(track)
    const albumQuery = `${trackTitle} ${trackArtist}`.trim()

    const loadRelatedArtists = async () => {
      let resolvedArtistId = artistId
      if (!resolvedArtistId && artistName) {
        const searchResponse = await axiosInstance.get('/search/artists', {
          params: { query: artistName, page: 0, limit: 1 },
          signal: controller.signal
        })
        resolvedArtistId = searchResponse.data?.data?.results?.[0]?.id
      }
      if (!resolvedArtistId) return { artists: [], albums: [] }

      const response = await axiosInstance.get(`/artists/${encodeURIComponent(String(resolvedArtistId))}`, {
        params: { page: 0, songCount: 0, albumCount: 0 },
        signal: controller.signal
      })
      const artistDetails = response.data?.data || {}
      let artistResults = artistDetails.similarArtists || []
      if (!artistResults.length) {
        const recommendations = await fetchRecommendationCandidates(track, axiosInstance)
        artistResults = recommendations.flatMap((suggestion) => [
          ...(suggestion.artists?.primary || []),
          ...(suggestion.artists?.all || []),
          ...(suggestion.artists?.featured || [])
        ])
      }
      const uniqueArtists = new Set()
      const artists = artistResults
        .filter((artist) => !artistNames.has(normalizeText(artist.name || artist.title)))
        .map((artist) => ({
          id: artist.id,
          name: artist.name || artist.title || 'Artist',
          image: getBestImageUrl(artist.image || artist.images || artist.image_url || artist.thumbnail || artist.cover || [])
        }))
        .filter((artist) => {
          const key = String(artist.id || normalizeText(artist.name))
          if (!artist.name || uniqueArtists.has(key)) return false
          uniqueArtists.add(key)
          return true
        })
        .slice(0, 5)
      return { artists, albums: artistDetails.topAlbums || [] }
    }

    const loadRelatedDetails = async () => {
      setDetails({ key: trackKey, artists: [], albums: [], artistsLoading: true, albumsLoading: true })

      const artistPromise = loadRelatedArtists().then(({ artists, albums }) => {
        if (!controller.signal.aborted) {
          setDetails((current) => current.key === trackKey
            ? { ...current, artists, artistsLoading: false }
            : current)
        }
        return albums
      }).catch(() => {
        if (!controller.signal.aborted) {
          setDetails((current) => current.key === trackKey
            ? { ...current, artists: [], artistsLoading: false }
            : current)
        }
        return []
      })
      const albumsPromise = (async () => {
        try {
          const albumResults = albumQuery
            ? await searchAlbums(albumQuery, 20, { signal: controller.signal })
            : []
          let relatedAlbums = filterRelatedAlbums(albumResults, album)
          if (!relatedAlbums.length) {
            const artistAlbums = await artistPromise
            relatedAlbums = filterRelatedAlbums(artistAlbums.map(normalizeArtistAlbum), album)
          }
          if (!controller.signal.aborted) {
            setDetails((current) => current.key === trackKey
              ? { ...current, albums: relatedAlbums, albumsLoading: false }
              : current)
          }
        } catch {
          if (!controller.signal.aborted) {
            setDetails((current) => current.key === trackKey
              ? { ...current, albums: [], albumsLoading: false }
              : current)
          }
        }
      })()

      await Promise.all([artistPromise, albumsPromise])
    }

    loadRelatedDetails()
    return () => controller.abort()
  }, [track])

  const currentAlbum = track?.id ? getTrackAlbum(track) : {}
  const trackKey = track?.id ? JSON.stringify([
      track.id,
      track.title || track.name || '',
      getTrackArtist(track),
      currentAlbum.id || currentAlbum._id || '',
      currentAlbum.name || currentAlbum.title || ''
    ])
    : ''
  const hasDetails = Boolean(trackKey) && details.key === trackKey

  return {
    artists: hasDetails ? details.artists : [],
    albums: hasDetails ? details.albums : [],
    artistsLoading: Boolean(trackKey) && (!hasDetails || details.artistsLoading),
    albumsLoading: Boolean(trackKey) && (!hasDetails || details.albumsLoading)
  }
}
