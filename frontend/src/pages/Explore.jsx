import { useEffect, useState } from 'react'
import MoodChips from '../components/sections/MoodChips'
import SongCard from '../components/cards/SongCard'
import Albums from '../components/sections/Albums'
import MixForYou from '../components/sections/MixForYou'
import Hollywood from '../components/sections/Hollywood'
import Loader from '../components/common/Loader'
import { usePlayer } from '../context/PlayerContext'
import { getHollywoodSongs, getQuickPicksSongs } from '../api/songs'
import { getAlbumsForYou } from '../api/albums'
import { getMixForYouPlaylists } from '../api/playlists'

const shuffleSongs = (songs) => {
    const shuffled = [...songs]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
    }

    return shuffled
}

const getDailySeed = () => `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`

const shuffleByDay = (items = []) => {
    const seed = getDailySeed()
    const shuffled = [...items]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const charCode = seed.charCodeAt((index + seed.length) % seed.length)
        const nextIndex = (charCode + index * 17) % (index + 1)
        ;[shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]]
    }

    return shuffled
}

export default function Explore() {
    const { listenHistory } = usePlayer()
    const [songs, setSongs] = useState([])
    const [albums, setAlbums] = useState([])
    const [playlists, setPlaylists] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        const loadDiscoveries = async () => {
            setLoading(true)
            setError('')

            try {
                const [results, albumResults, playlistResults] = await Promise.all([
                    getQuickPicksSongs(listenHistory, 30),
                    getAlbumsForYou(listenHistory, 10),
                    getMixForYouPlaylists(listenHistory, 10),
                ])

                if (isMounted) {
                    setSongs(shuffleSongs(results).slice(0, 30))
                    setAlbums(shuffleByDay(albumResults))
                    setPlaylists(shuffleByDay(playlistResults))
                }
            } catch {
                if (isMounted) {
                    setSongs([])
                    setAlbums([])
                    setPlaylists([])
                    setError('Unable to load fresh discoveries right now.')
                }
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        loadDiscoveries()
        return () => {
            isMounted = false
        }
    }, [listenHistory])

    return (
    <div className="space-y-5 md:space-y-10">
        <div>
            <p className="mb-1 md:mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
                Browse the feeling
            </p>
            <h1 className="font-['Space_Grotesk'] md:text-4xl text-3xl font-bold">
                For you
            </h1>
            <p className="mt-1 md:mt-3 text-sm text-white/45">
                A little more of what makes the day sound right.
            </p>
        </div>
        <MoodChips />
        <section>
            <h2 className="mb-5 text-2xl md:text-3xl font-bold">
                Fresh discoveries
            </h2>
            {loading ? (
                <div className="flex min-h-56 items-center justify-center">
                    <Loader label="Loading fresh discoveries" />
                </div>
            ) : songs.length ? (
                <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pb-3">
                    <div className="grid w-max auto-cols-[minmax(10rem,11.25rem)] grid-flow-col grid-rows-2 gap-x-6 gap-y-8">
                        {songs.map((song) => (
                            <SongCard key={song.id} song={song} queue={songs} />
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-red-400">{error || 'No fresh discoveries are available right now.'}</p>
            )}
        </section>

        {albums.length > 0 && <Albums albums={albums} title="Albums for you" />}
        {playlists.length > 0 && <MixForYou playlists={playlists} title="Mix for you" eyebrow="Curated for you" />}
        <Hollywood songs={getHollywoodSongs(songs, 24)} />
        <br />
        <br />
        <br />
    </div>
    )
}