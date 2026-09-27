import { Settings2, Home, Library, Plus } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import Button from '../common/Button'

const navItems = [{ to: '/', label: 'Home', icon: Home }, { to: '/explore', label: 'Recommended', icon: Settings2 }, { to: '/library', label: 'Library', icon: Library }]

export default function Sidebar({ locked = false }) {
    const navigate = useNavigate()

    const disabledState = locked ? 'pointer-events-none select-none opacity-60' : 'opacity-100'

    return <aside className={`fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/9 bg-[#050505] px-2 py-4 lg:flex ${disabledState}`} aria-disabled={locked}>
    <div className="mb-7 mt-3 flex items-center gap-2 px-4">
        <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-black/20 shadow-[0_8px_25px_rgba(0,0,0,0.35)]">
            <img src="/logo2.png" alt="Logo" className="h-full w-full object-cover" />
        </div>
        <span className="text-2xl font-['Bahnschrift_Condensed'] font-semibold tracking-tight">
            Autumn
        </span>
    </div>
    <nav className="space-y-1">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} tabIndex={locked ? -1 : 0} aria-disabled={locked} className={({ isActive }) => `flex items-center gap-5 rounded-lg px-4 py-3 text-md font-semibold transition ${isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'} ${locked ? 'pointer-events-none' : ''}`}><Icon size={20} />{label}</NavLink>)}</nav>
    <br />
    <hr />
    <br />
    <div className="mt-8 space-y-7 px-4 text-xs">
        <button disabled={locked} onClick={() => navigate('/liked-songs')} className={locked ? 'pointer-events-none opacity-60' : ''}>
            <p className="mb-2 text-sm font-bold text-white">
                Liked music
            </p>
            <p className="text-white/55">
                ♪ Auto playlist
            </p>
        </button>
    </div>
    <br />
    <Button disabled={locked} onClick={() => navigate('/new-playlist')} variant="ghost" className={`mx-3 flex w-[calc(100%-24px)] items-center justify-center gap-2 border-0 bg-white/30 py-2.5 ${locked ? 'pointer-events-none opacity-60' : ''}`}><Plus size={19} /> New playlist</Button>
  </aside>
}