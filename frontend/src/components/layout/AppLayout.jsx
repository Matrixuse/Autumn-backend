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
    const { isAuthenticated } = useAuth()
    const location = useLocation()
    const [searchState, setSearchState] = useState({ query: '', history: [], results: [], loading: false })
    const isKeepListeningRoute = location.pathname.startsWith('/keep-listening')
    const isNowPlayingRoute = location.pathname.startsWith('/now-playing')
    const locked = !isAuthenticated && !isKeepListeningRoute

    return (
        <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_12%_0%,#062029_0%,transparent_28%),radial-gradient(circle_at_100%_0%,#252313_0%,transparent_24%),#050505] text-white">
            <Sidebar locked={locked} />
            <main className="min-h-screen lg:pl-60">
                <div className={isNowPlayingRoute ? 'hidden lg:block' : ''}><Topbar locked={locked} onSearchStateChange={setSearchState} /></div>
                <div className={`relative mx-auto min-h-100vh w-full ${isNowPlayingRoute ? 'px-0 pb-0 pt-0 lg:px-20 lg:pb-24 lg:pt-9' : 'px-4 pb-44 pt-5 sm:px-8 sm:pb-24 sm:pt-7 lg:px-20 lg:pb-24 lg:pt-9'}`}>
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
    )
}