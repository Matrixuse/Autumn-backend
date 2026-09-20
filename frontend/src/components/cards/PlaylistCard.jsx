import { Link } from 'react-router-dom'
import { getBestImageUrl } from '../../utils/mediaQuality'
import SongActionsMenu from '../common/SongActionsMenu'
import { usePlayer } from '../../context/PlayerContext'

export default function PlaylistCard({ song, playlist, to, compact = false, itemType = 'playlist', items = [] }) {
    const { isNotInterested } = usePlayer()
    if (isNotInterested(playlist)) return null
    const image = getBestImageUrl(playlist.image || playlist.images || playlist.more_info?.images)
    const playlistId = playlist.id || playlist._id
    const playlistSlug = encodeURIComponent(String(playlist.name || playlist.title || 'playlist'))
    const destination = to || `/playlist/${encodeURIComponent(String(playlistId))}/${playlistSlug}`
    
    return (
        <article className={`group relative ${compact ? 'w-36 min-w-36 shrink-0' : 'min-w-40.5 md:min-w-42.5 flex-1'}`}>
            <Link to={destination} className="block">
                <div className={`${compact ? 'aspect-square rounded-lg' : 'aspect-square rounded-xl'} overflow-hidden bg-[#28251f]`}>
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full art-sheen" />}
                </div>
                <h3 className={`${compact ? 'mt-2 text-xs' : 'mt-3 text-sm'} truncate pr-8 font-bold text-white`}>
                    {playlist.name}
                </h3>
                <p className={`${compact ? 'mt-1 text-[10px]' : 'mt-1 text-xs'} truncate pr-8 text-white/40`}>
                    {playlist.description || 'A personal collection'}
                </p>
            </Link>
            <div className="absolute bottom-0 right-0 md:bottom-auto md:right-2 md:top-2"><SongActionsMenu song={playlist} itemType={itemType} items={items} mobileAlwaysVisible /></div>
        </article>
    )
}