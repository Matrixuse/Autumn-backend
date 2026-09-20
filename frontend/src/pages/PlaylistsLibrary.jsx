import { useEffect, useState } from 'react'
import { ArrowLeft, LogOut, UserRound } from 'lucide-react'
import Avatar from '../components/common/Avatar'
import { Link, useNavigate } from 'react-router-dom'
import Loader from '../components/common/Loader'
import PlaylistCard from '../components/cards/PlaylistCard'
import { moodPlaylistSeeds, searchPlaylists } from '../api/playlists'
import { useAuth } from '../context/AuthContext'


const visibleMoods = moodPlaylistSeeds.slice(0, 10)

export default function PlaylistsLibrary({locked = false}) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadPlaylists = async () => {
      const results = await Promise.all(visibleMoods.map(async ({ mood, query }) => {
        try {
          const playlists = await searchPlaylists(query, 8)
          const unique = [...new Map(playlists.map((playlist) => [`${playlist.id}-${playlist.name}`, playlist])).values()]
          return { mood, playlists: unique }
        } catch {
          return { mood, playlists: [] }
        }
      }))

      if (isMounted) {
        setGroups(results.filter((group) => group.playlists.length))
        setLoading(false)
      }
    }

    loadPlaylists()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full bg-white/6 p-2 hover:bg-white/12 hidden sm:block"><ArrowLeft size={20} /></button>
        <div className="flex flex-1 items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">Your listening space</p>
            <h1 className="font-['Space_Grotesk'] lg:text-4xl text-2xl font-bold">Playlists</h1>
            <p className="mt-2 text-sm text-white/45">Find a mix for every mood.</p>
          </div>
          <div className="block sm:hidden">
              <div className="relative">
                <button disabled={locked} aria-label="Account menu" className={locked ? 'cursor-not-allowed' : ''}><Avatar label={user?.username || 'Hi'} /></button>
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

      {loading ? <div className="grid min-h-56 place-items-center"><Loader label="Loading playlists" /></div> : groups.length ? groups.map(({ mood, playlists }) => (
        <section key={mood}>
          <h2 className="mb-4 font-['Space_Grotesk'] text-2xl font-bold capitalize">{mood}</h2>
          <div className="scrollbar-none -mx-1 flex gap-5 overflow-x-auto px-1 pb-2">
            {playlists.map((playlist) => <PlaylistCard key={`${mood}-${playlist.id}`} playlist={playlist} />)}
          </div>
        </section>
      )) : <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/45">No mood playlists are available right now.</p>}
    </div>
  )
}
