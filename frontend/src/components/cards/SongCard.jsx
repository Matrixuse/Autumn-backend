import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import SongActionsMenu from '../common/SongActionsMenu'
import { getBestImageUrl } from '../../utils/mediaQuality'

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
    const { playTrack, isNotInterested, currentTrack, isPlaying } = usePlayer()
    const imageSource = getBestImageUrl(song?.image || song?.cover || song?.thumbnail || song?.artwork || song?.images || song?.img)
    const [imageFailed, setImageFailed] = useState(false)
    useEffect(() => setImageFailed(false), [imageSource])
    if (isNotInterested(song)) return null
    const image = imageFailed ? null : imageSource
    const color = artwork[getColorIndex(song?.id)]
    const title = song?.title || song?.name || 'Untitled track'
    const artist = song?.artist || song?.artists?.all?.[0]?.name || song?.subtitle || 'Unknown Artist'

    return (
        <article className="group relative min-w-35 flex-1 md:min-w-40 md:max-w-45">
            <div className="relative">
                <button onClick={() => playTrack(song, queue)} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-[#28251f] text-left shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_16px_35px_rgba(0,0,0,.35)]">
                    {image ? <img src={image} alt="" onError={() => setImageFailed(true)} className="h-full w-full object-cover" /> : <div className={`relative h-full w-full overflow-hidden bg-linear-to-br ${color}`}>
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
                    {isPlaying && String(currentTrack?.id) === String(song?.id) && (
                        <span className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-transparent text-[#fffffe] shadow-lg">
                            <Play size={30} fill="currentColor" />
                        </span>
                    )}
                </button>
            </div>
            <h3 className="mt-3 truncate pr-8 text-sm font-bold text-white/90">
                {title}
            </h3>
            <p className="truncate pr-8 text-xs text-white/50">
                Song · {artist}
            </p>
            <div className="absolute bottom-0 right-0 md:bottom-auto md:right-2 md:top-2">
                <SongActionsMenu song={song} queue={queue} mobileAlwaysVisible />
            </div>
        </article>
    )
}