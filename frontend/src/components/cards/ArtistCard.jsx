import { getBestImageUrl } from '../../utils/mediaQuality'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export default function ArtistCard({ artist, compact = false }) { 
    const image = getBestImageUrl(artist.image); 
    const [imageFailed, setImageFailed] = useState(false)
    
    const destination = `/artist/${encodeURIComponent(String(artist.id || artist.name || 'artist'))}/${encodeURIComponent(String(artist.name || 'artist'))}`

    return (
        <article className={`${compact ? 'w-32 min-w-32' : 'min-w-45 flex-1'} text-center`}>
            <Link to={destination} className="block">
            <div className={`${compact ? 'h-24 w-24' : 'aspect-square max-w-37.5'} mx-auto overflow-hidden rounded-full border-4 border-[#28251f] bg-[#28251f] shadow-xl`}>
                {image && !imageFailed ? (
                    <img src={image} alt={artist.name || 'Artist'} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#28251f] px-2 text-center text-xs font-bold uppercase tracking-[.14em] text-white/70">Artist</div>
                )}
            </div>
            <h3 className={`${compact ? 'line-clamp-2' : 'truncate'} mt-3 text-sm font-semibold`}>
                {artist.name}
            </h3>
            <p className="mt-1 text-xs text-white/40">
                Artist
            </p>
            </Link>
        </article>
    ) 
}