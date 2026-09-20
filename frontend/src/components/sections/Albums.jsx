import PlaylistCard from '../cards/PlaylistCard'

export default function Albums({ albums, title = 'Albums for you' }) {
    return (
        <section>
            <div className="mb-5">
                <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold">
                    {title}
                </h2>
            </div>
            <div className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pb-2">
                {albums.map((album) => (
                    <div key={album.id} className="block min-w-40.5 md:min-w-42.5 flex-1">
                        <PlaylistCard
                            playlist={album}
                            itemType="album"
                            items={album.songs || album.list || []}
                            to={`/album/${album.id}/${encodeURIComponent(album.name || 'album')}`}
                        />
                    </div>
                ))}
            </div>
        </section>
    )
}