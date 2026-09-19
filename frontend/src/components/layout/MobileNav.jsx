import { Home, Library, ListMusic, Search, FastForward } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'For you', icon: FastForward },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/library', label: 'Library', icon: Library }
]

export default function MobileNav({ locked = false }) {
  return (
    <nav aria-disabled={locked} className={`mobile-nav fixed inset-x-0 bottom-0 z-30 flex bg-[#090a0a]/65 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden ${locked ? 'pointer-events-none opacity-60' : 'opacity-100'}`}>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked}
          className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-semibold sm:text-[11px] ${isActive ? 'text-white font-extrabold' : 'text-white/45'} ${locked ? 'pointer-events-none' : ''}`}
        >
          <Icon size={19}/>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
