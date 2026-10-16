import { Heart, ListMusic, Music2, Play, CircleFadingPlus, Search, LogOut, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import MoodChips from '../components/sections/MoodChips'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/common/Avatar'
import SongActionsMenu from '../components/common/SongActionsMenu'
import PlaylistCover from '../components/common/PlaylistCover'

export default function Library({locked = false}) {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const { userPlaylists, setUserPlaylists, playTrack } = usePlayer()
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

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
    </div>
    )
}