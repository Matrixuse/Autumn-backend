import { useState } from 'react'
import { ListMusic } from 'lucide-react'
import { getPlaylistCoverModel } from '../../utils/playlistCover.js'

function CoverTile({ src }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden bg-[#28251f]">
      {src && !imageFailed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/40" aria-hidden="true">
          <ListMusic size={20} />
        </div>
      )}
    </div>
  )
}

export default function PlaylistCover({ playlist, songs, alt = '', className = '' }) {
  const { layout, images } = getPlaylistCoverModel(playlist, songs)
  const coverLabel = alt ? `${alt} cover` : 'Playlist cover'
  const tiles = (images.length ? images : [null]).map((src, index) => (
    <CoverTile key={`${index}-${src || 'fallback'}`} src={src} />
  ))

  let layoutClass = 'grid-cols-1 grid-rows-1'
  if (layout === 'two') layoutClass = 'grid-cols-2 grid-rows-1'
  if (layout === 'three') layoutClass = 'grid-cols-[1fr_2fr] grid-rows-2'
  if (layout === 'four') layoutClass = 'grid-cols-2 grid-rows-2'

  return (
    <div role="img" aria-label={coverLabel} className={`relative grid aspect-square w-full overflow-hidden bg-[#28251f] ${layoutClass} ${className}`.trim()}>
      {layout === 'three'
        ? <>
            <div className="row-span-2 min-h-0 min-w-0 overflow-hidden">{tiles[0]}</div>
            {tiles[1]}
            {tiles[2]}
          </>
        : tiles}
    </div>
  )
}