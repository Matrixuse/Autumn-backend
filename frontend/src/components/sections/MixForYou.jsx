import PlaylistCard from '../cards/PlaylistCard'
import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function MixForYou({ playlists = [], title = 'Mix for you', eyebrow = 'Your like playlists', limit }) {
    const navigate = useNavigate()
    const visiblePlaylists = typeof limit === 'number' ? playlists.slice(0, limit) : playlists

    return (
        <section>
            <div className="mb-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">
                    {eyebrow}
                </p>
                <div className='flex items-center justify-between'>
                    <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className='flex items-center font-bold text-[#fffff]'
                        onClick={() => navigate('/playlists')}
                    >
                        <ChevronRight />
                    </button>
                </div>
            </div>
            <div className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pb-2">
                {visiblePlaylists.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
            </div>
        </section>
    )
}