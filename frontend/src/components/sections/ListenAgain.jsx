import SongCard from '../cards/SongCard'

export default function ListenAgain({ songs }) { return (
    <section>
        <div className="flex items-center gap-4 mb-3">
            <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">
                    Your listening space
                </p>
                <h1 className="font-['Space_Grotesk'] md:text-3xl font-bold text-2xl">
                    Listen again
                </h1>
            </div>
        </div>
        <div className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pb-2">{songs.map((song) => 
                <SongCard key={song.id} song={song} queue={songs} />
            )}
        </div>
    </section>
)}