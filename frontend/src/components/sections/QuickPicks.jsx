import { usePlayer } from '../../context/PlayerContext'
import SongActionsMenu from '../common/SongActionsMenu'
import { Play } from 'lucide-react'

const formatDuration = (seconds) => {
    const totalSeconds = Number(seconds || 0)
    if (!totalSeconds) return '0:00'

    const minutes = Math.floor(totalSeconds / 60)
    const secs = Math.floor(totalSeconds % 60)
    return `${minutes}:${String(secs).padStart(2, '0')}`
}

const shortTitle = (value, max = 26) => {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const getArtistLabel = (artist) => {
    if (!artist) return 'Unknown Artist'
    if (typeof artist === 'string') return artist
    if (Array.isArray(artist)) return artist.filter(Boolean).map((item) => String(item.name || item.title || item)).join(', ') || 'Unknown Artist'
    if (typeof artist === 'object') return artist.name || artist.title || 'Unknown Artist'
    return String(artist)
}

export default function QuickPicks({ songs = [], title = 'Quick picks', eyebrow = 'Made for the moment', limit = 24, homeMobileGrid = false }) {
    const { playTrack, currentTrack, isPlaying } = usePlayer()
    const visibleSongs = Array.isArray(songs) ? songs.slice(0, limit) : []
    const columnCount = Math.max(1, Math.ceil(visibleSongs.length / 4))

    return (
        <section>
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">
                        {eyebrow}
                    </p>
                    <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold leading-none tracking-[-0.04em] text-white">
                        {title}
                    </h2>
                </div>
            </div>

            {homeMobileGrid && (
                <div className="scrollbar-none -mx-1 grid auto-cols-[calc((100vw-3rem)/3)] grid-flow-col grid-rows-3 gap-2 overflow-x-auto px-1 md:hidden">
                    {visibleSongs.map((song, index) => (
                        <article key={song.id || `${song.title}-mobile-${index}`} className="min-w-0">
                            <button
                                type="button"
                                aria-label={`Play ${song.title || 'song'}`}
                                onClick={() => playTrack(song, visibleSongs)}
                                className="group relative aspect-square w-full overflow-hidden rounded-lg bg-[#28251f] text-left shadow-[0_8px_20px_rgba(0,0,0,0.28)]"
                            >
                                {song.image ? (
                                    <img src={song.image} alt="" className="h-full w-full object-cover transition duration-300 group-active:scale-105" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#4a4138] to-[#140f13] text-center text-[10px] font-black uppercase tracking-[.12em] text-white/75">
                                        {song.title?.slice(0, 2) || 'AU'}
                                    </div>
                                )}
                                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/55 to-transparent px-2">
                                    <span className="block truncate text-xs font-bold text-white">{shortTitle(song.title, 22)}</span>
                                </span>
                            </button>
                        </article>
                    ))}
                </div>
            )}

            <div className={`scrollbar-none -mx-1 gap-3 overflow-x-auto px-1 pb-2 ${homeMobileGrid ? 'hidden md:flex' : 'flex'}`}>
                {Array.from({ length: columnCount }).map((_, columnIndex) => {
                    const columnSongs = visibleSongs.slice(columnIndex * 4, columnIndex * 4 + 4)

                    return (
                        <div
                            key={`quick-pick-column-${columnIndex}`}
                            className="flex min-w-82.5 flex-col gap-1 md:min-w-87.5"
                        >
                            {columnSongs.map((song, index) => (
                                <article
                                    key={song.id || `${song.title}-${columnIndex}-${index}`}
                                    className="group cursor-pointer rounded border border-white/0 bg-transparent p-0"
                                    onClick={() => playTrack(song, visibleSongs)}
                                >
                                    <div className="mr-1 flex items-center gap-3 rounded bg-transparent p-1 transition hover:bg-white/2 md:mr-3">
                                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[#28251f] shadow-[0_8px_25px_rgba(0,0,0,0.35)]">
                                            {song.image ? (
                                                <img src={song.image} alt={song.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#4a4138] to-[#140f13] text-[10px] font-black uppercase tracking-[.2em] text-white/75">
                                                    {song.title?.slice(0, 2) || 'AU'}
                                                </div>
                                            )}
                                            <button type="button" aria-label={`Play ${song.title || 'song'}`} onClick={(event) => { event.stopPropagation(); playTrack(song, visibleSongs) }} className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                                                <span className="grid h-7 w-7 place-items-center rounded-full bg-transparent text-white"><Play size={27} fill="currentColor" /></span>
                                            </button>
                                            {isPlaying && String(currentTrack?.id) === String(song?.id) && <span className="absolute bottom-1 left-1 grid h-6 w-6 place-items-center rounded-full bg-[#d29a55] text-[#17130e]"><Play size={13} fill="currentColor" /></span>}
                                        </div>

                                        <div className="flex min-w-0 flex-col justify-between gap-1">
                                            <h3 className="truncate text-[1.05rem] font-bold text-white">
                                                {shortTitle(song.title, 26)}
                                            </h3>
                                            <div className="flex min-w-0 items-center gap-2 truncate text-[13px] tracking-widest text-white/55">
                                                <span>{getArtistLabel(song.artist)}</span>
                                            </div>
                                        </div>
                                        <div className="relative ml-auto h-8 min-w-8 shrink-0">
                                            <span className="absolute inset-0 grid place-items-center whitespace-nowrap text-sm font-medium text-white/70 transition-opacity group-hover:opacity-0">
                                                {formatDuration(song.duration)}
                                            </span>
                                            <div className="absolute inset-0 flex items-center justify-end">
                                                <SongActionsMenu song={song} queue={visibleSongs} />
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}