import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Play, Search, Shuffle, X } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import QuickPicks from '../components/sections/QuickPicks';
import Albums from '../components/sections/Albums';
import { getReleaseAlbums } from '../api/albums';
import { getMoodQuickPicksSongs } from '../api/songs';
import { usePlayer } from '../context/PlayerContext';
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality';
import SongActionsMenu from '../components/common/SongActionsMenu';
import Loader from '../components/common/Loader';

const normalizeSong = (song = {}) => ({
  id: song.id || song._id || `${song.name || song.title || 'song'}-${Math.random().toString(36).slice(2, 8)}`,
  title: song.name || song.title || 'Unknown Track',
  artist: Array.isArray(song.artists?.all)
    ? song.artists.all.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
    : Array.isArray(song.artists?.primary)
      ? song.artists.primary.map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
      : song.artist || song.subtitle || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || song.more_info?.images || []) || null,
  audio: getBestAudioUrl(song.downloadUrl || song.audio) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  raw: song,
});

export default function AlbumsPage() {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const { albumId, albumName: routeAlbumName } = useParams();
  const { playTrack } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [relatedSongs, setRelatedSongs] = useState([]);
  const [releaseAlbums, setReleaseAlbums] = useState([]);
  const [albumName, setAlbumName] = useState(decodeURIComponent(String(routeAlbumName || '')) || 'Album');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const desktopScrollContainerRef = useRef(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadAlbum = async () => {
      try {
        setLoading(true);
        setError('');

        const currentAlbumId = String(albumId || '').trim();

        if (!currentAlbumId) {
          setSongs([]);
          setError('Album not found.');
          return;
        }

        const response = await axiosInstance.get('/albums', {
          params: { id: currentAlbumId },
          signal: controller.signal,
        });

        const album = response.data?.data;
        const trackList = Array.isArray(album?.songs) ? album.songs : [];
        const normalizedSongs = trackList.map(normalizeSong);
        const nextName = album?.name || decodeURIComponent(String(routeAlbumName || '')) || 'Album';

        const [relatedResult, releasesResult] = await Promise.allSettled([
          getMoodQuickPicksSongs(nextName, 24),
          getReleaseAlbums(nextName, 8)
        ]);
        const related = relatedResult.status === 'fulfilled' ? relatedResult.value : [];
        const releases = releasesResult.status === 'fulfilled' ? releasesResult.value : [];

        if (controller.signal.aborted) return;

        setSongs(normalizedSongs);
        setRelatedSongs(related.slice(0, 24));
        setReleaseAlbums(releases.slice(0, 8));

        setAlbumName(nextName);

        if (routeAlbumName !== encodeURIComponent(nextName)) {
          navigate(`/album/${currentAlbumId}/${encodeURIComponent(nextName)}`, { replace: true });
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load this album right now.');
          setSongs([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadAlbum();
    return () => controller.abort();
  }, [albumId, navigate, routeAlbumName]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const containers = [mobileScrollContainerRef.current, desktopScrollContainerRef.current].filter(Boolean);
    if (!containers.length) return;

    const updateHeaderState = () => {
      const maxScrollTop = containers.reduce((max, container) => Math.max(max, container.scrollTop || 0), 0);
      setIsHeaderExpanded(maxScrollTop < 50);
    };

    containers.forEach((container) => container.addEventListener('scroll', updateHeaderState));
    updateHeaderState();

    return () => containers.forEach((container) => container.removeEventListener('scroll', updateHeaderState));
  }, []);

  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) return songs;

    const query = searchTerm.toLowerCase();
    return songs.filter((song) => {
      const title = (song.title || '').toLowerCase();
      const artistText = (song.artist || '').toLowerCase();
      return title.includes(query) || artistText.includes(query);
    });
  }, [searchTerm, songs]);

  const hasSearchResults = filteredSongs.length > 0;

  const formatDuration = (song) => {
    const duration = Number(song?.duration || 0);
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-8 text-white">
        <Loader label="Loading album" />
      </div>
    );
  }

  if (!songs.length) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-white">
        <div className="max-w-md rounded-2xl border border-gray-700 bg-[#0f0f0f]/80 p-8 shadow-xl">
          <p className="text-lg font-semibold">No songs available in this album yet.</p>
          <p className="mt-2 text-sm text-gray-400">{error || 'The album has no matching tracks in the current library.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-col md:hidden">
        <div className="mb-0 flex items-center gap-3">
              {isHeaderExpanded ? <h1 className="flex-1" /> : <h1 className="flex-1 text-xl font-bold">{albumName}</h1>}
              <div className="flex items-center gap-2">
                <button onClick={() => setSearchOpen((value) => !value)} className="shrink-0 rounded-full bg-[#0f0f0f] p-2 hover:bg-[#282828]">
                  {searchOpen ? <X size={18} /> : <Search size={18} />}
                </button>
                <button className="shrink-0 rounded-full bg-[#0f0f0f] p-2 hover:bg-[#5f5f5f]" title="Shuffle songs">
                  <Shuffle size={20} className="text-white" />
                </button>
              </div>
        </div>
        <div className="flex min-h-0 min-w-0 grow flex-col">
          <div className={`shrink-0 transition-all duration-300 ${isHeaderExpanded ? 'bg-[#0f0f0f]/80 p-6' : 'bg-[#0f0f0f]/80 p-3'}`}>

            {isHeaderExpanded && (
              <div className="flex items-center">
                <img
                  src={songs[0]?.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'}
                  alt={albumName}
                  className="h-24 w-24 rounded-lg object-cover shadow-lg"
                />
                <div className="mt-3 w-full">
                  <h2 className="ml-5 text-2xl font-bold leading-none tracking-tight text-white">{albumName}</h2>
                  <div className="ml-5 mt-3 flex items-center justify-start gap-5 md:gap-6">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500" aria-label="Play album">
                      <Play className="ml-1 h-5 w-5 fill-white text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {searchOpen && (
            <div className="shrink-0 bg-[#0f0f0f]/80 px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search within ${albumName}...`}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-full bg-[#1f1f1f]/40 py-2 pl-10 pr-3 text-sm text-white focus:bg-[#1f1f1f] focus:outline-none"
                  autoComplete="off"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          <hr className="h-px bg-[#5f5f5f]" />
          <div ref={mobileScrollContainerRef} className="grow overflow-y-auto pt-5 md:p-4 pb-24 custom-scrollbar">
            <div className="grid grid-cols-1 gap-2">
              {hasSearchResults ? filteredSongs.map((song) => (
                <div key={song.id} className="group relative cursor-pointer rounded bg-[#0f0f0f]/50 p-1 transition-colors hover:bg-[#282828]/80" onClick={() => playTrack(song, songs)}>
                  <div className="relative flex w-full min-w-0 items-start gap-3">
                    <div className="shrink-0">
                      <img src={song.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'} alt={song.title} className="h-10 w-10 rounded-md object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden mr-17 md:mr-0">
                      <h4 className="truncate text-sm font-semibold text-white">{song.title}</h4>
                      <p className="truncate text-xs text-gray-400">{song.artist}</p>
                    </div>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-2"><span className="text-xs text-gray-300">{formatDuration(song)}</span><SongActionsMenu song={song} queue={songs} alwaysVisible /></div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-10 text-center">
                  <p className="text-base font-semibold text-white">Song not found</p>
                  <p className="mt-2 text-sm text-white/45">No song in this album matches “{searchTerm}”.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:h-[calc(100vh-10rem)] md:min-h-0 md:min-w-0 md:flex-1 md:flex-row md:overflow-hidden">
        <div className="flex h-full min-h-0 shrink-0 flex-col border-r border-gray-800 bg-[#0f0f0f]/80 p-6 lg:w-107.5 lg:min-w-107.5 md:w-90 md:min-w-90 md:p-5">
          <div className="mb-0 flex items-center gap-3 md:mb-4">
            <button type="button" onClick={goBack} className="shrink-0 rounded-full bg-[#0f0f0f] p-2 hover:bg-[#282828]" aria-label="Go back">
              <ArrowLeft size={20} />
            </button>
          </div>

          <div className="lg:mt-4 md:mt-8 md:flex md:flex-col md:items-center md:text-center">
            <img
              src={songs[0]?.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'}
              alt={albumName}
              className="lg:h-56 lg:w-56 rounded-xl object-cover shadow-lg md:h-34 md:w-34"
            />
            <div className="mt-5 flex-1 md:mt-7 md:w-full">
              <h2 className="lg:text-4xl md:text-2xl font-bold leading-none tracking-tight text-white">{albumName}</h2>
              <div className="mt-6 flex items-center justify-center gap-5 md:gap-6">
                <button className="rounded-full p-2 text-white transition-colors hover:bg-[#282828]" aria-label="Play album">
                  <Shuffle size={20} className="fill-white text-white" />
                </button>
                <button className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500 md:h-16 md:w-16" aria-label="Play album">
                  <Play className="ml-1 h-7 w-7 fill-white text-white md:h-8 md:w-8" />
                </button>
                <SongActionsMenu song={{ id: albumId, name: albumName }} itemType="album" items={songs} alwaysVisible />
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 bg-[#0f0f0f]/80 px-4 py-2 pb-2 md:px-6 md:pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search songs in ${albumName}...`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded bg-[#1f1f1f]/40 py-2 pl-10 pr-10 text-sm text-white focus:bg-[#1f1f1f] focus:outline-none"
                autoComplete="off"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div ref={desktopScrollContainerRef} className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 scrollbar-none">
            <div className="mr-3 space-y-1 md:space-y-1">
              {hasSearchResults ? filteredSongs.map((song) => (
                <div key={song.id} className="group relative flex cursor-pointer items-center gap-1 overflow-visible rounded border-b border-gray-800 bg-[#0f0f0f]/50 px-1 py-1 pr-12 transition-colors hover:bg-[#282828]/80 lg:gap-4 lg:px-1 lg:py-1 lg:pr-14 md:gap-4 md:px-1 md:py-1 md:pr-1" onClick={() => playTrack(song, songs)}>
                  <div className="shrink-0">
                    <img src={song.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'} alt={song.title} className="h-10 w-10 rounded object-cover md:h-10 md:w-10" />
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="truncate text-sm font-semibold text-white md:text-base">{song.title}</div>
                      <div className="truncate text-xs text-gray-400 md:text-sm">{song.artist}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="mr-1 text-xs text-gray-300 md:text-sm">{formatDuration(song)}</span>
                      <SongActionsMenu song={song} queue={songs} />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-10 text-center">
                  <p className="text-base font-semibold text-white">Song not found</p>
                  <p className="mt-2 text-sm text-white/45">No song in this album matches “{searchTerm}”.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {relatedSongs.length > 0 && (
        <div className="mt-12 pb-12">
          <QuickPicks songs={relatedSongs} />
        </div>
      )}

      {releaseAlbums.length > 0 && (
        <div className="mt-5 pb-20">
          <Albums albums={releaseAlbums} title="Releases for you" />
        </div>
      )}
    </>
  );
}
