import { Check, Heart, ListMusic, Music2, Play, CircleFadingPlus, Plus, Search, LogOut, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import MoodChips from '../components/sections/MoodChips'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/common/Avatar'
import SongActionsMenu from '../components/common/SongActionsMenu'
import PlaylistCover from '../components/common/PlaylistCover'
import axiosInstance from '../api/axiosInstance'
import { fetchRecommendationCandidates } from '../api/recommendations'
import { getBestImageUrl } from '../utils/mediaQuality'

const getArtistsFromTrack = (track = {}) => {
    const artists = [
        ...(Array.isArray(track.artists?.primary) ? track.artists.primary : []),
        ...(Array.isArray(track.artists?.all) ? track.artists.all : []),
        ...(Array.isArray(track.artists?.featured) ? track.artists.featured : [])
    ].filter((artist) => artist?.id || artist?.name || artist?.title)

    if (artists.length) return artists
    return String(track.artist || track.primaryArtists || track.subtitle || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
}

const normalizeArtist = (artist = {}) => {
    const name = artist.name || artist.title
    const id = artist.id || artist._id || name
    return name && id ? {
        id: String(id),
        name: String(name),
        image: getBestImageUrl(artist.image || artist.images || artist.thumbnail || artist.image_url) || null
    } : null
}

export default function Library({locked = false}) {
    const navigate = useNavigate()
    const { user, logout, isAuthenticated } = useAuth()
    const { userPlaylists, setUserPlaylists, playTrack, listenHistory, likedSongs, followedArtists, toggleFollowArtist } = usePlayer()
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [suggestedArtists, setSuggestedArtists] = useState([])
    const [suggestionsLoading, setSuggestionsLoading] = useState(true)

    const artistSeedTracks = useMemo(() => {
        const uniqueTracks = new Map()
        for (const track of [...likedSongs, ...listenHistory]) {
            if (track?.id && !uniqueTracks.has(String(track.id))) uniqueTracks.set(String(track.id), track)
        }
        return [...uniqueTracks.values()].slice(0, 3)
    }, [likedSongs, listenHistory])
    const followedArtistSignature = followedArtists
        .map((artist) => String(artist?.id || artist?._id || ''))
        .filter(Boolean)
        .sort()
        .join(',')
    const suggestionsCacheKey = `autumn_suggested_artists:${user?.id || 'anonymous'}:${followedArtistSignature || 'none'}`

    useEffect(() => {
        let active = true

        const loadSuggestedArtists = async () => {
            try {
                const cached = JSON.parse(localStorage.getItem(suggestionsCacheKey) || 'null')
                if (Array.isArray(cached) && cached.length) {
                    setSuggestedArtists(cached)
                    setSuggestionsLoading(false)
                    return
                }
            } catch {
                // Continue with a fresh request when browser storage is unavailable.
            }

            setSuggestionsLoading(true)
            const excludedIds = new Set(followedArtists.map((artist) => String(artist?.id || artist?._id || '')).filter(Boolean))
            const excludedNames = new Set(followedArtists.map((artist) => String(artist?.name || artist?.title || '').trim().toLowerCase()).filter(Boolean))
            artistSeedTracks.forEach((track) => getArtistsFromTrack(track).forEach((artist) => {
                const normalized = normalizeArtist(artist)
                if (normalized) {
                    excludedIds.add(normalized.id)
                    excludedNames.add(normalized.name.trim().toLowerCase())
                }
            }))

            try {
                let artistResults = []
                if (artistSeedTracks.length) {
                    const candidateBatches = await Promise.allSettled(
                        artistSeedTracks.map((track) => fetchRecommendationCandidates(track, axiosInstance, () => true))
                    )
                    artistResults = candidateBatches.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
                }

                const artistsById = new Map()
                artistResults.forEach((track) => getArtistsFromTrack(track).forEach((artist) => {
                    const normalized = normalizeArtist(artist)
                    if (!normalized || excludedIds.has(normalized.id) || excludedNames.has(normalized.name.trim().toLowerCase())) return
                    artistsById.set(normalized.id, normalized)
                }))

                if (artistsById.size < 8) {
                    try {
                        const response = await axiosInstance.get('/search/artists', {
                            params: { query: artistSeedTracks.length ? 'trending music artists' : 'popular singers', page: 0, limit: 20 }
                        })
                        const popularArtists = response.data?.data?.results || []
                        popularArtists.forEach((artist) => {
                            const normalized = normalizeArtist(artist)
                            if (!normalized || excludedIds.has(normalized.id) || excludedNames.has(normalized.name.trim().toLowerCase())) return
                            artistsById.set(normalized.id, normalized)
                        })
                    } catch {
                        // Keep any related artists already found.
                    }
                }

                if (active) {
                    const suggestions = [...artistsById.values()].slice(0, 12)
                    setSuggestedArtists(suggestions)
                    if (suggestions.length) {
                        try {
                            localStorage.setItem(suggestionsCacheKey, JSON.stringify(suggestions))
                        } catch {
                            // Keep the suggestions available for this session.
                        }
                    }
                }
            } catch {
                if (active) setSuggestedArtists([])
            } finally {
                if (active) setSuggestionsLoading(false)
            }
        }

        loadSuggestedArtists()
        return () => { active = false }
    }, [artistSeedTracks, followedArtists, suggestionsCacheKey])

    const filteredPlaylists = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) return userPlaylists
        return userPlaylists.filter((playlist) => {
            const name = (playlist.name || '').toLowerCase()
            const description = (playlist.description || '').toLowerCase()
            return name.includes(term) || description.includes(term)
        })
    }, [searchTerm, userPlaylists])

    return (
    <div className="space-y-5 md:space-y-5">
        <div>
            <p className="mb-1 md:mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
                Your space
            </p>
            <div className="mb-5 flex items-center justify-between">
                <h1 className="font-['Space_Grotesk'] lg:text-4xl text-2xl font-bold">
                    Library
                </h1>
                <div className="flex items-center gap-5 text-sm hover:text-white/50 sm:hidden">
                    <button disabled={locked} onClick={() => navigate('/new-playlist')} className={locked ? 'cursor-not-allowed' : ''}>
                        <CircleFadingPlus />
                    </button>
                    <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label={searchOpen ? 'Close playlist search' : 'Search playlists'} className="rounded-full p-1 text-white hover:bg-white/10 hover:text-white">
                        <Search size={23} />
                    </button>
                    <div className="block sm:hidden">
                        <div className="relative">
                            <button disabled={locked} aria-label="Account menu" className={locked ? 'cursor-not-allowed' : ''}><Avatar label={user?.username || 'Hi'} image={user?.avatar || user?.image} /></button>
                            <div className="absolute right-0 top-11 w-44 translate-y-2 rounded-xl border border-white/10 bg-[#1a1b1a] p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                                {user ? 
                                    <div>
                                    <Link to="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white">
                                        <UserRound size={15} />
                                        Profile
                                    </Link>
                                        <button disabled={locked} onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
                                        <LogOut size={15} />
                                        Log out
                                        </button>
                                    </div> :    <div>
                                    <Link to="/login" className="block rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white">
                                        Login
                                    </Link>
                                    <Link to="/signup" className="block rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white">
                                        Sign Up
                                    </Link>
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {searchOpen && <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search your playlists..." aria-label="Search your playlists" className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#dddad5] sm:hidden" />}
        </div>
        <MoodChips />
        <div className="md:grid gap-3 sm:gap-4 md:grid-cols-3">
            <button onClick={() => navigate('/liked-songs')} className="flex items-center gap-4 sm:block sm:flex-1 md:rounded-2xl md:border hover:border border-white/10 p-4 sm:p-5 text-left transition hover:bg-white/8">
                <Heart className="shrink-0 text-[#f20909] fill-[#f20909] sm:mb-8" />
                <div className="min-w-0 sm:flex sm:flex-col sm:items-start">
                    <p className="text-lg font-bold">
                        Liked music
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                        Songs you want to keep close
                    </p>
                </div>
            </button>
            <button type="button" onClick={() => navigate('/playlists')} className="flex items-center gap-4 md:rounded-2xl md:border hover:border border-white/10 p-4 sm:block sm:p-5 text-left transition hover:bg-white/8">
                <ListMusic className="shrink-0 text-[#efedeb] sm:mb-8" />
                <div className="min-w-0">
                    <p className="text-lg font-bold">
                        Playlists
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                        Your hand-picked collections
                    </p>
                </div>
            </button>
            <Link to="/recently-played" className="flex items-center gap-4 md:rounded-2xl md:border hover:border border-white/20 p-4 sm:block sm:p-5 text-left transition hover:bg-white/8">
                <Music2 className="shrink-0 text-[#0a989f] sm:mb-8" />
                <div className="min-w-0">
                    <p className="text-lg font-bold">
                        Recently played
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                        Pick up where you left off
                    </p>
                </div>
            </Link>
        </div>
        <section>
            <h2 className="mb-3 text-xl font-bold">
                Your playlists
            </h2>
            <div className="grid grid-cols-1 space-y-2 md:grid-cols-4 md:gap-5 md:space-y-0 lg:grid-cols-6 lg:gap-5 lg:space-y-0">
                {filteredPlaylists.length ? filteredPlaylists.map((playlist) => (
                    <div key={playlist.id} className="group relative md:max-w-[180px]">
                        <button type="button" onClick={() => navigate(`/playlist/${encodeURIComponent(String(playlist.id))}/${encodeURIComponent(playlist.name || 'playlist')}`)}
                            className="relative flex w-full items-center gap-3 rounded border border-white/10 bg-white/1 p-1 pr-12 text-left transition hover:bg-white/8 md:aspect-square md:flex-col md:items-stretch md:justify-end md:overflow-hidden md:rounded-lg md:p-0 md:pr-0"
                        >
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#28251f] text-white/60 md:absolute md:inset-0 md:h-full md:w-full md:rounded-none">
                                <PlaylistCover playlist={playlist} alt={playlist.name || 'Untitled playlist'} className="h-full w-full" />
                            </span>
                            <span
                                className="min-w-0 flex-1 md:absolute md:inset-x-0 md:bottom-0 md:z-10 md:bg-gradient-to-t md:from-black/90 md:via-black/45 md:to-transparent md:px-4 md:pb-4 md:pt-12"
                            >
                                <span className="block truncate font-semibold">
                                    {playlist.name || 'Untitled playlist'}
                                </span>
                                <span className="block truncate text-xs text-white/45">
                                    {playlist.description || `${playlist.songs?.length || 0} songs`}
                                </span>
                            </span>
                            <Play size={17} className="hidden text-white/50 md:block lg:hidden" />
                        </button>
                        <div className="absolute right-2 top-1/2 z-20 -translate-y-1/2 md:hidden">
                            <SongActionsMenu
                                song={playlist}
                                itemType="playlist"
                                items={playlist.songs || []}
                                mobileAlwaysVisible
                                onDelete={() => {
                                    if (!window.confirm(`Delete "${playlist.name || 'Untitled playlist'}"?`)) return
                                    setUserPlaylists((items) => items.filter((item) => String(item.id) !== String(playlist.id)))
                                }}
                            />
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-20 hidden opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 lg:block">
                            <button type="button" disabled={!playlist.songs?.length} aria-label={`Play all from ${playlist.name || 'playlist'}`} title="Play all" onClick={(event) => { event.stopPropagation(); if (playlist.songs?.length) playTrack(playlist.songs[0], playlist.songs) }} className="pointer-events-auto absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-blue-100 text-black shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50">
                                <Play size={20} fill="currentColor" />
                            </button>
                            <div className="pointer-events-auto absolute right-2 top-2">
                                <SongActionsMenu
                                    song={playlist}
                                    itemType="playlist"
                                    items={playlist.songs || []}
                                    onDelete={() => {
                                        if (!window.confirm(`Delete "${playlist.name || 'Untitled playlist'}"?`)) return
                                        setUserPlaylists((items) => items.filter((item) => String(item.id) !== String(playlist.id)))
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-white/45">{searchTerm.trim() ? 'No playlists match your search.' : 'Your playlist will appear here.'}</p>}
            </div>
        </section>
        <section aria-labelledby="suggested-artists-heading" className="mt-8">
            {suggestionsLoading ? (
                <p className="text-sm text-white/45" role="status">Finding artists for you...</p>
            ) : suggestedArtists.length ? (
                <div className="space-y-2">
                    {suggestedArtists.map((artist) => {
                        const isFollowing = followedArtists.some((followed) => String(followed?.id || followed?._id || '') === artist.id)
                        const artistUrl = `/artist/${encodeURIComponent(artist.id)}/${encodeURIComponent(artist.name)}`
                        return (
                                <div key={artist.id} className="flex min-h-16 items-center gap-3 bg-transparent px-3 py-2 transition-colors hover:bg-white/5 sm:gap-4 sm:px-4">
                                    <Link to={artistUrl} aria-label={`Open ${artist.name}`} className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white/5 text-sm font-semibold text-white/50 sm:h-12 sm:w-12">
                                        <span aria-hidden="true">{artist.name.slice(0, 1).toUpperCase()}</span>
                                        {artist.image && <img src={artist.image} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} />}
                                    </Link>
                                    <Link to={artistUrl} className="min-w-0 flex-1 truncate text-sm font-semibold text-white hover:underline sm:text-base">
                                        {artist.name}
                                    </Link>
                                    <button
                                        type="button"
                                        aria-pressed={isFollowing}
                                        aria-label={isFollowing ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
                                        onClick={() => {
                                            if (!isAuthenticated) {
                                                navigate('/login')
                                                return
                                            }
                                            toggleFollowArtist(artist)
                                        }}
                                        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-4 sm:text-sm ${isFollowing ? 'border border-white/35 bg-transparent text-white hover:bg-white/10' : 'bg-white text-black hover:bg-white/85'}`}
                                    >
                                        {isFollowing ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-white/45">Artist suggestions are unavailable right now.</p>
            )}
        </section>
    </div>
    )
}