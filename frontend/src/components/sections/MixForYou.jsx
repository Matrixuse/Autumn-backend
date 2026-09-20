import PlaylistCard from '../cards/PlaylistCard'

export default function MixForYou({ playlists = [], title = 'Mix for you', eyebrow = 'Your like playlists', limit }) {
    const visiblePlaylists = typeof limit === 'number' ? playlists.slice(0, limit) : playlists

    return (
        <section>
            <div className="mb-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">
                    {eyebrow}
                </p>
                <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold">
                    {title}
                </h2>
            </div>
            <div className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pb-2">
                {visiblePlaylists.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
            </div>
        </section>
    )
}