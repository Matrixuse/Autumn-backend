import { Play } from 'lucide-react'
import { usePlayer } from '../../context/PlayerContext'
import SongActionsMenu from '../common/SongActionsMenu'

const artwork = ['from-[#3d291f] via-[#b36e37] to-[#1c2830]', 'from-[#132f3b] via-[#2e7b95] to-[#d2bd8c]', 'from-[#c5d8d5] via-[#9ec2d1] to-[#e4d4af]', 'from-[#fafafa] via-[#db4b7a] to-[#a01c49]', 'from-[#151d28] via-[#1babc2] to-[#090b11]', 'from-[#242326] via-[#727078] to-[#d7d1bf]']

const getColorIndex = (value) => {
    const text = String(value ?? 'autumn')
    let hash = 0

    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0
    }

    return hash % artwork.length
}

export default function SongCard({ song, queue = [] }) {
    const { playTrack, isNotInterested } = usePlayer()
    if (isNotInterested(song)) return null
    const image = song?.image || null
    const color = artwork[getColorIndex(song?.id)]
    const title = song?.title || song?.name || 'Untitled track'
    const artist = song?.artist || song?.artists?.all?.[0]?.name || song?.subtitle || 'Unknown Artist'

    return (
        <article className="group min-w-35 md:min-w-40 md:max-w-45 flex-1">
            <div className="relative">
                <button onClick={() => playTrack(song, queue)} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-[#28251f] text-left shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_16px_35px_rgba(0,0,0,.35)]">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className={`relative h-full w-full overflow-hidden bg-linear-to-br ${color}`}>
                        <div className="absolute left-1/2 top-[42%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/30 bg-black/15" />
                            <div className="absolute inset-x-0 bottom-5 text-center text-xs font-bold tracking-[.25em] text-white/80">
                                AUTUMN
                            </div>
                        </div>
                    }
                    <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-transparent text-white">
                            <Play size={48} fill="currentColor" />
                        </span>
                    </span>
                </button>
                <div className="absolute right-2 top-2">
                    <SongActionsMenu song={song} queue={queue} />
                </div>
            </div>
            <h3 className="mt-3 truncate text-sm font-bold text-white/90">
                {title}
            </h3>
            <p className="mt-1 truncate text-xs text-white/50">
                Song · {artist}
            </p>
        </article>
    )
}