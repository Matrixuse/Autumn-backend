import { useState } from 'react'
import PlaylistCard from '../cards/PlaylistCard'
import SongCard from '../cards/SongCard'
import { getBestImageUrl } from '../../utils/mediaQuality'

export default function ArtistSpotlight({ artist, entries = [], songs = [] }) {
    const artistImage = getBestImageUrl(artist?.image || artist?.images)
    const [failedImageUrl, setFailedImageUrl] = useState('')

    if (!artist || entries.length !== 10) return null

    return (
        <section>
            <div className="mb-5 flex items-center gap-3 md:gap-4">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 md:h-14 md:w-14 lg:h-16 lg:w-16">
                    {artistImage && failedImageUrl !== artistImage ? (
                        <img src={artistImage} alt="" onError={() => setFailedImageUrl(artistImage)} className="h-full w-full object-cover" />
                    ) : (
                        <span className="grid h-full w-full place-items-center text-sm font-bold text-white/70">
                            {artist.name.slice(0, 1)}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="md:mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">
                        More from
                    </p>
                    <h2 className="truncate font-['Space_Grotesk'] text-2xl font-bold md:text-3xl">
                        {artist.name}
                    </h2>
                </div>
            </div>
            <div className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pb-2">
                {entries.map((entry) => entry.kind === 'song' ? (
                    <SongCard key={`song-${entry.item.id}`} song={entry.item} queue={songs} />
                ) : (
                    <PlaylistCard
                        key={`${entry.kind}-${entry.item.id}`}
                        playlist={entry.item}
                        itemType={entry.kind === 'album' ? 'album' : 'playlist'}
                        items={entry.item.songs || entry.item.list || []}
                        to={entry.kind === 'album' ? `/album/${encodeURIComponent(String(entry.item.id))}/${encodeURIComponent(entry.item.name || 'album')}` : undefined}
                    />
                ))}
            </div>
        </section>
    )
}