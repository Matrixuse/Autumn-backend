import { Info, LogOut, Menu, RefreshCw, SlidersHorizontal, UserRound, X } from 'lucide-react'
import SearchBar from '../common/SearchBar'
import Avatar from '../common/Avatar'
import { useAuth } from '../../context/AuthContext'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export default function Topbar({ locked = false, onSearchStateChange }) {
    const { user, logout } = useAuth()
    const location = useLocation()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
    const accountMenuRef = useRef(null)
    const isHomePage = location.pathname === '/'
    const isSearchPage = location.pathname === '/search'
    const isExplorePage = location.pathname === '/explore'
    const isPlaylistsPage = location.pathname === '/playlists' || location.pathname.startsWith('/playlist/')
    const isLibraryPage = location.pathname === '/library'
    const isMobileHiddenPage = location.pathname === '/recently-played' || location.pathname === '/liked-songs' || location.pathname === '/keep-listening' || location.pathname.startsWith('/album/') || location.pathname.startsWith('/artist/') || location.pathname.startsWith('/mood/')
    const disabledState = locked ? 'pointer-events-none opacity-60' : ''
    const closeMenu = () => setIsMenuOpen(false)

    useEffect(() => {
        if (!isAccountMenuOpen) return undefined

        const handleOutsideClick = (event) => {
            if (!accountMenuRef.current?.contains(event.target)) setIsAccountMenuOpen(false)
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [isAccountMenuOpen])

    return (
    <>
    <header aria-disabled={locked} className={`${isMobileHiddenPage ? 'hidden md:flex' : isLibraryPage || isExplorePage ? 'hidden lg:flex' : isPlaylistsPage ? 'hidden md:flex' : 'flex'} sticky top-0 z-20 items-center gap-4 bg-[#080909]/80 px-5 py-3 backdrop-blur-xl lg:px-10 ${disabledState}`}>
        {isHomePage ? (
            <div className={`${isExplorePage ? 'flex md:hidden' : 'flex'} md:hidden`}>
                <img src="/logo.png" alt="Autumn logo" className='h-7 w-7 gap-3' />
                <h1 className="text-xl font-bold text-white">Autumn</h1>
            </div>
        ) : (
            <button disabled={locked} onClick={() => setIsMenuOpen(true)} className={`${isHomePage || isSearchPage || isExplorePage || isPlaylistsPage ? 'hidden' : 'text-white/70 lg:hidden'}`} aria-label="Open navigation menu" aria-expanded={isMenuOpen}>
                <Menu size={21} />
            </button>
        )}
        {isMenuOpen && (
        <div className="fixed mt-56 z-50 flex items-start bg-black/70 lg:hidden" role="gridcell" onClick={closeMenu}>
            <section className="w-full max-w-sm rounded border border-white/10 bg-[#171817] p-1 text-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="navigation-menu-title" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 px-1">
                    <button onClick={closeMenu} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close navigation menu">
                        <X size={20} />
                    </button>
                </div>
                <nav aria-label="Navigation menu">
                    <Link to="/profile" onClick={closeMenu} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                        <UserRound size={18} />
                        Profile
                    </Link>
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white">
                        <RefreshCw size={18} />
                        App Updates
                    </button>
                    <Link to="/equalizer" onClick={closeMenu} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                        <SlidersHorizontal size={18} />
                        Equalizer
                    </Link>
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white">
                        <Info size={18} />
                        About
                    </button>
                    {user && (
                        <button onClick={() => { closeMenu(); logout() }} className="flex w-full items-center gap-3 border-t border-white/10 px-3 py-2 pt-4 text-left text-sm text-[#e6a44a] hover:bg-white/10">
                            <LogOut size={18} />
                            Logout
                        </button>
                    )}
                </nav>
            </section>
        </div>
        )}
        <div className={`lg:w-[395px] lg:flex-none ${isHomePage || isExplorePage || isPlaylistsPage ? 'hidden lg:block' : 'flex-1'}`}>
            <SearchBar disabled={locked} onSearchStateChange={onSearchStateChange} />
        </div>
        <div className={`relative ml-auto flex items-center gap-2 text-white/80 ${isSearchPage || isExplorePage ? 'hidden lg:flex' : ''} ${locked ? 'pointer-events-none' : ''}`}>
            <h4 className="hidden text-sm sm:block">Hi, {user?.username || 'there'}</h4>
            <div ref={accountMenuRef} className="relative">
                <button
                    disabled={locked}
                    onClick={() => setIsAccountMenuOpen((open) => !open)}
                    aria-label="Account menu"
                    aria-expanded={isAccountMenuOpen}
                    className={locked ? 'cursor-not-allowed' : ''}
                >
                    <Avatar label={user?.username || 'Hi'} />
                </button>
                {isAccountMenuOpen && <div className="absolute right-0 top-11 z-30 w-44 rounded-xl border border-white/10 bg-[#1a1b1a] p-2 shadow-xl">
                    {user ? 
                    <div>
                        <Link to="/profile" onClick={() => setIsAccountMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white">
                            <UserRound size={15} />
                            Profile
                        </Link>
                        <button disabled={locked} onClick={() => { setIsAccountMenuOpen(false); logout() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
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
                </div>}
            </div>
        </div>
    </header>
    
    </>
)}