import { Play } from 'lucide-react'
import { usePlayer } from '../../context/PlayerContext'

export default function SectionPlayAllButton({ songs = [], onPlay, className = '' }) {
    const { playTrack } = usePlayer()
    const tracks = Array.isArray(songs) ? songs : []

    const handlePlayAll = () => {
        if (!tracks.length) return
        if (onPlay) {
            onPlay()
            return
        }
        playTrack(tracks[0], tracks)
    }

    return (
        <button
            type="button"
            onClick={handlePlayAll}
            disabled={!tracks.length}
            className={`flex shrink-0 items-center gap-1.5 md:mr-5 rounded-full bg-transparent border border-gray-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40 md:gap-2 md:px-3 md:py-2 md:text-sm ${className}`}
        >
            <Play size={12} fill="currentColor" aria-hidden="true" />
            Play all
        </button>
    )
}