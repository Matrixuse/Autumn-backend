import SongCard from '../cards/SongCard'

export default function Moods({ songs = [], title = 'Your Moods', eyebrow = 'Moods that you like', limit = 24 }) { return (
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
            {songs.slice(0, limit).map((song) => 
                <SongCard key={song.id} song={song} queue={songs} />
            )}
        </div>
    </section>
)}