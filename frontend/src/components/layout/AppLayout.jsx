import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import PlayerBar from '../player/PlayerBar'
import MobileNav from './MobileNav'
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AppLayout() { 
    const { isAuthenticated, loading } = useAuth()
    const location = useLocation()
    const [searchState, setSearchState] = useState({ query: '', history: [], results: [], loading: false })
    const isHomePage = location.pathname === '/'
    const isKeepListeningRoute = location.pathname.startsWith('/keep-listening')
    const isNowPlayingRoute = location.pathname.startsWith('/now-playing')
    const isLikedSongsRoute = location.pathname.startsWith('/liked-songs')
    const isFooterInfoRoute = location.pathname.startsWith('/info/')
    const isPublicInfoRoute = location.pathname.startsWith('/info/') || location.pathname === '/feedback'
    const locked = !loading && !isAuthenticated && !isKeepListeningRoute && !isPublicInfoRoute

    return (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-[#030303] text-white">
            {isHomePage && <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-r from-[#42121e]/40 via-[#030303]/10 to-[#14291b]/40 blur-[90px]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-transparent to-[#030303]" />
            </>}
            <div className="relative z-10 w-full">
            <Sidebar locked={locked} />
            <main className={`${isLikedSongsRoute ? 'min-h-screen md:h-dvh md:min-h-0 md:overflow-hidden' : 'min-h-screen'} lg:pl-60 ${isHomePage ? 'bg-gradient-to-b from-[#1628069b] via-[#0c0c14] to-[#0d0a27]' : isLikedSongsRoute ? 'bg-gradient-to-b from-[#0b0b0b] via-[#0c0c14] to-[#000000]' : 'bg-gradient-to-b from-[#0811289b] via-[#0c0c14] to-[#000000]'} text-white`}>
                <div className={isNowPlayingRoute ? 'hidden lg:block' : isFooterInfoRoute ? 'hidden md:block' : ''}><Topbar locked={locked} onSearchStateChange={setSearchState} /></div>
                <div className={`relative mx-auto min-h-100vh w-full ${isNowPlayingRoute ? 'px-0 pb-0 pt-0 lg:px-20 lg:pb-24 lg:pt-9' : isHomePage ? 'px-4 pb-44 pt-1 sm:px-4 sm:pb-24 sm:pt-7 lg:px-20 lg:pb-24 lg:pt-9' : isLikedSongsRoute ? 'px-4 pb-44 pt-5 sm:px-4 sm:pb-24 sm:pt-7 lg:px-20 lg:pb-24 lg:pt-9' : 'px-4 pb-44 pt-5 sm:px-4 sm:pb-24 sm:pt-7 lg:px-20 lg:pb-24 lg:pt-9'}`}>
                    <Outlet context={{ searchState }} />
                    {locked && (
                        <div className="absolute inset-0 z-10 flex items-start justify-center bg-[#050505]/80 px-4 pt-24 backdrop-blur-[3px] sm:pt-32">
                            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111311]/95 p-7 text-center shadow-2xl sm:p-10">
                                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#e6a44a]/15 text-[#b58239]">
                                    <LockKeyhole size={25} />
                                </div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
                                    Your listening space is waiting
                                </p>
                                <h1 className="font-['Space_Grotesk'] text-2xl font-bold sm:text-3xl">
                                    Log in to continue
                                </h1>
                                <p className="mt-3 text-sm leading-6 text-white/45">
                                    Sign in or create an account to explore music, use your library, and control playback.
                                </p>
                                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                                    <Link to="/login" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c88d3b] px-4 py-3 text-sm font-bold text-[#21160a] hover:bg-[#f1b65d]">
                                        <LogIn size={17} />
                                        Log in
                                    </Link>
                                    <Link to="/signup" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">
                                        <UserPlus size={17} />
                                        Register
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <div className={`${locked ? 'pointer-events-none opacity-60' : ''} ${isNowPlayingRoute ? 'hidden lg:block' : ''}`}>
                <PlayerBar />
            </div>
            <div className={isNowPlayingRoute ? 'hidden lg:block' : ''}><MobileNav locked={locked} /></div>
            </div>
        </div>
    )
}