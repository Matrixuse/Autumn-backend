import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Play, Search, Shuffle, X } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import Albums from '../components/sections/Albums';
import QuickPicks from '../components/sections/QuickPicks';
import { usePlayer } from '../context/PlayerContext';
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality';
import SongActionsMenu from '../components/common/SongActionsMenu';
import Loader from '../components/common/Loader';

const getSongArtists = (song = {}) => {
  const items = [];

  if (Array.isArray(song?.artists?.all)) {
    items.push(...song.artists.all.map((artist) => artist?.name || artist?.title).filter(Boolean));
  }
  if (Array.isArray(song?.artists?.primary)) {
    items.push(...song.artists.primary.map((artist) => artist?.name || artist?.title).filter(Boolean));
  }
  if (Array.isArray(song?.artists?.featured)) {
    items.push(...song.artists.featured.map((artist) => artist?.name || artist?.title).filter(Boolean));
  }
  if (song?.artist) {
    if (Array.isArray(song.artist)) items.push(...song.artist.filter(Boolean));
    else items.push(song.artist);
  }
  if (typeof song?.subtitle === 'string') items.push(song.subtitle);

  return [...new Set(items.filter(Boolean))];
};

const normalizeSong = (song = {}) => ({
  id: song.id || song._id || `${song.name || song.title || 'song'}-${Math.random().toString(36).slice(2, 8)}`,
  title: song.name || song.title || 'Unknown Track',
  artist: getSongArtists(song).join(', ') || song.subtitle || 'Unknown Artist',
  image: getBestImageUrl(song.image || song.cover || song.artwork || song.thumbnail || []) || null,
  audio: getBestAudioUrl(song.downloadUrl || song.audio) || null,
  duration: Number(song.duration || song.more_info?.duration || 0) || 0,
  raw: song
});

const getArtistImageFromSongs = (songs, artistId, artistName) => {
  const normalizedName = String(artistName || '').trim().toLowerCase();
  const matchingArtist = songs
    .flatMap((song) => [
      ...(Array.isArray(song?.artists?.primary) ? song.artists.primary : []),
      ...(Array.isArray(song?.artists?.all) ? song.artists.all : [])
    ])
    .find((artist) => (
      (artistId && String(artist?.id) === String(artistId))
      || (normalizedName && String(artist?.name || '').trim().toLowerCase() === normalizedName)
    ));

  return getBestImageUrl(matchingArtist?.image || matchingArtist?.image_url || []) || '';
};

const normalizeArtistBio = (bio, name) => {
  const text = Array.isArray(bio)
    ? bio
        .sort((first, second) => Number(first?.sequence || 0) - Number(second?.sequence || 0))
        .map((entry) => entry?.text || entry?.title)
        .filter(Boolean)
        .join(' ')
    : typeof bio === 'string'
      ? bio
      : '';

  return text.trim() || `${name} is a celebrated voice whose music has connected with listeners across generations. Explore the artist's popular songs, latest releases, and albums below.`;
};

export default function ArtistPage() {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const { artistId, artistName: routeArtistName } = useParams();
  const { playTrack } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artistBio, setArtistBio] = useState('');
  const [artistImage, setArtistImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm] = useState('');
  const searchInputRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const desktopScrollContainerRef = useRef(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  const artistName = decodeURIComponent(String(routeArtistName || '')) || 'Artist';

  useEffect(() => {
    const controller = new AbortController();

    const loadArtistSongs = async () => {
      try {
        setLoading(true);
        setError('');
        setArtistImage('');

        let resolvedArtistId = artistId;
        let resolvedArtistName = artistName;

        if (!resolvedArtistId || !/^[0-9]+$/.test(String(resolvedArtistId))) {
          const queryName = decodeURIComponent(String(resolvedArtistId || artistName || ''));
          if (queryName) {
            const response = await axiosInstance.get('/search/artists', {
              params: { query: queryName, page: 0, limit: 5 },
              signal: controller.signal
            });
            const result = response.data?.data?.results?.[0];
            if (result) {
              resolvedArtistId = result.id;
              resolvedArtistName = result.name || queryName;
              setArtistImage(getBestImageUrl(result.image || result.cover || result.thumbnail || result.artwork || []) || '');
            }
          }
        }

        if (!resolvedArtistId) {
          setArtistImage('');
          setSongs([]);
          setAlbums([]);
          setArtistBio('');
          setLoading(false);
          return;
        }

        const [songsResult, albumsResult] = await Promise.allSettled([
          axiosInstance.get(`/artists/${resolvedArtistId}/songs`, {
            params: { page: 0, limit: 500, sortBy: 'popularity', sortOrder: 'desc' },
            signal: controller.signal
          }),
          axiosInstance.get(`/artists/${resolvedArtistId}/albums`, {
            params: { page: 0, sortBy: 'popularity', sortOrder: 'desc' },
            signal: controller.signal
          }),
        ]);

        const songsResponse = songsResult.status === 'fulfilled' ? songsResult.value : null;
        const albumsResponse = albumsResult.status === 'fulfilled' ? albumsResult.value : null;
        const result = Array.isArray(songsResponse?.data?.data?.songs) ? songsResponse.data.data.songs : [];
        const normalized = result.map(normalizeSong).slice(0, 25);
        const artistAlbums = Array.isArray(albumsResponse?.data?.data?.albums) ? albumsResponse.data.data.albums : [];
        const randomAlbums = [...artistAlbums].sort(() => Math.random() - 0.5).slice(0, 8);
        const detailsName = resolvedArtistName || artistName;
        const bio = normalizeArtistBio('', detailsName);
        const songArtistImage = getArtistImageFromSongs(result, resolvedArtistId, detailsName);

        if (!controller.signal.aborted) {
          setSongs(normalized);
          setAlbums(randomAlbums);
          setArtistBio(bio);
          if (songArtistImage) setArtistImage(songArtistImage);
          if (resolvedArtistName && routeArtistName !== encodeURIComponent(resolvedArtistName)) {
            navigate(`/artist/${resolvedArtistId}/${encodeURIComponent(resolvedArtistName)}`, { replace: true });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load this artist right now.');
          setSongs([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadArtistSongs();
    return () => controller.abort();
  }, [artistId, artistName, navigate, routeArtistName]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const containers = [mobileScrollContainerRef.current, desktopScrollContainerRef.current].filter(Boolean);
    if (!containers.length) return;

    const pathKey = `artist-scroll:${window.location.pathname}`;
    const currentScrollTop = () => Math.max(
      window.scrollY || document.documentElement.scrollTop || 0,
      ...containers.map((container) => container.scrollTop || 0)
    );

    const saveScroll = () => {
      const maxScrollTop = currentScrollTop();
      sessionStorage.setItem(pathKey, String(maxScrollTop));
    };

    const updateHeaderState = () => {
      const maxScrollTop = currentScrollTop();
      setIsHeaderExpanded(maxScrollTop < 50);
    };

    const savedScroll = Number(sessionStorage.getItem(pathKey) || 0);
    if (savedScroll > 0) {
      containers.forEach((container) => {
        container.scrollTop = savedScroll;
      });
    } else {
      containers.forEach((container) => {
        container.scrollTop = 0;
      });
    }

    setIsHeaderExpanded((savedScroll || 0) < 50);

    containers.forEach((container) => container.addEventListener('scroll', updateHeaderState));
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    const handleBeforeUnload = () => saveScroll();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      saveScroll();
      containers.forEach((container) => container.removeEventListener('scroll', updateHeaderState));
      window.removeEventListener('scroll', updateHeaderState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [artistId, artistName, loading]);

  const displayArtistImage = artistImage || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Artist';

  const filteredSongs = useMemo(() => {
    const matching = songs;

    if (!searchTerm.trim()) return matching.slice(0, 25);

    const query = searchTerm.toLowerCase();
    return matching.filter((song) => {
      const title = (song.title || '').toLowerCase();
      const artistText = (song.artist || '').toLowerCase();
      return title.includes(query) || artistText.includes(query);
    });
  }, [searchTerm, songs]);

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
        <Loader label="Loading artist" />
      </div>
    );
  }

  if (!filteredSongs.length) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-white">
        <div className="max-w-md rounded-2xl border border-gray-700 bg-[#0f0f0f]/80 p-8 shadow-xl">
          <p className="text-lg font-semibold">No songs available for this artist yet.</p>
          <p className="mt-2 text-sm text-gray-400">{error || 'The artist has no matching tracks in the current library.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="md:h-[calc(100vh-13rem)] md:min-h-0">
      <div className={`z-30 mb-0 flex items-center gap-3 transition-all duration-300 ${isHeaderExpanded ? 'relative h-0 overflow-hidden opacity-0 md:h-auto md:overflow-visible md:opacity-100' : 'fixed inset-x-0 top-0 h-14 bg-[#0f0f0f]/95 px-3 opacity-100 shadow-lg backdrop-blur-md md:static md:h-auto md:bg-transparent md:px-0 md:shadow-none md:backdrop-blur-none'}`}>
        {isHeaderExpanded ? <h1 className="hidden flex-1 md:block" /> : <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-white">{artistName}</h1>}
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen((value) => !value)} className="shrink-0 rounded-full bg-[#0f0f0f] p-2 transition-colors hover:bg-[#282828]" aria-label={searchOpen ? 'Close artist search' : 'Search artist songs'}>
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
          <button className="shrink-0 rounded-full bg-[#0f0f0f] p-2 transition-colors hover:bg-[#5f5f5f]" title="Shuffle songs" aria-label="Shuffle songs">
            <Shuffle size={20} className="text-white" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col md:hidden">
        <div className="flex min-h-0 min-w-0 grow flex-col">
          <div
            className={`relative shrink-0 overflow-hidden transition-all duration-300 ${isHeaderExpanded ? 'bg-[#0f0f0f]/80 p-6' : 'bg-[#0f0f0f]/80 p-3'}`}
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,15,15,0.3), rgba(15,15,15,0.82)), url(${displayArtistImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
          <div className="absolute inset-0 bg-black/20" />
            {isHeaderExpanded && (
              <div className="relative z-10">
                <div className='mt-20 flex items-center justify-between w-full'>
                  <h2 className="md:ml-5 mt-2 text-2xl font-bold leading-none tracking-tight text-white">{artistName}</h2>
                  <div className="ml-5 md:mt-3 flex items-center justify-between gap-3 md:gap-6">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500" aria-label="Play artist songs">
                      <Play className="ml-1 h-5 w-5 fill-white text-white" />
                    </button>
                    <div className="relative">
                      <button className="rounded-full bg-transparent p-2 text-white transition-colors hover:bg-[#282828]" aria-label="Artist actions">
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <hr className="h-px bg-[#5f5f5f]" />
          <div ref={mobileScrollContainerRef} className="grow overflow-y-auto p-1 pt-5 pb-4 custom-scrollbar">
            <div className="grid grid-cols-1 gap-2">
              {filteredSongs.map((song) => (
                <div key={song.id} className="group relative cursor-pointer rounded bg-[#0f0f0f]/50 p-1 transition-colors hover:bg-[#282828]/80" onClick={() => playTrack(song, filteredSongs)}>
                  <div className="relative flex w-full min-w-0 items-start gap-2 ">
                    <div className="shrink-0">
                      <img src={song.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'} alt={song.title} className="h-11 w-11 rounded-md object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden mr-17 md:mr-0">
                      <h4 className="truncate text-sm font-semibold text-white">{song.title}</h4>
                      <p className="truncate text-xs text-gray-400">{song.artist}</p>
                    </div>
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-end gap-2"><span className="text-xs text-gray-300">{formatDuration(song)}</span><SongActionsMenu song={song} queue={filteredSongs} alwaysVisible /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden h-full md:flex md:min-h-0 md:min-w-0 md:flex-1 md:flex-row md:overflow-hidden">
        <div
          className="relative shrink-0 overflow-hidden border-r border-gray-800 bg-[#0f0f0f]/80 p-2 md:w-100 md:min-w-100 lg:w-150 lg:min-w-150  md:sticky md:top-0 md:h-full md:p-2"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(15,15,15,0.25), rgba(15,15,15,0.75)), url(${displayArtistImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center">
              <button type="button" onClick={goBack} className="shrink-0 rounded-full bg-[#0f0f0f]/60 p-2 backdrop-blur-sm hover:bg-[#282828]" aria-label="Go back">
                <ArrowLeft size={20} />
              </button>
            </div>

            <div className="lg:mt-70 md:mt-57  flex items-center gap-5 pb-1 text-center">
              <img 
                src={songs[0]?.image || 'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'} 
                alt={artistName} 
                className="h-40 w-40 rounded object-cover shadow-lg lg:h-40 lg:w-40 md:h-30 md:w-28"
              />
              <div className="ml-6 flex flex-col items-center justify-center">
                <h2 className="text-4xl font-bold leading-none tracking-tight text-white">{artistName}</h2>
                <div className="mt-6 flex items-center justify-center gap-5 md:gap-6">
                <button className="rounded-full bg-[#0f0f0f]/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-[#282828]/80" aria-label="Play artist songs">
                  <Shuffle size={20} className="fill-white text-white" />
                </button>
                <button className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500 md:h-16 md:w-16" aria-label="Play artist songs">
                  <Play className="ml-1 h-7 w-7 fill-white text-white md:h-8 md:w-8" />
                </button>
                <SongActionsMenu song={filteredSongs[0]} queue={filteredSongs} alwaysVisible />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={desktopScrollContainerRef} className="mt-2 min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-4 md:pb-28 scrollbar-none">
            <div className="space-y-1 md:space-y-1 scrollbar-none">
              {filteredSongs.map((song) => (
                <div key={song.id} className="group relative flex cursor-pointer items-center gap-1 overflow-visible rounded border-b border-gray-800 bg-[#0f0f0f]/50 px-1 py-1 transition-colors hover:bg-[#282828]/80 md:gap-4 md:px-1 md:py-1 lg:pr-5" onClick={() => playTrack(song, filteredSongs)}>
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
                      <SongActionsMenu song={song} queue={filteredSongs} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-15 pb-8">
        <QuickPicks songs={songs} />
      </div>

      {albums.length > 0 && (
        <div className="mt-7 pb-8">
          <Albums albums={albums} title="Top Albums" />
        </div>
      )}

      <section className="mt-5 pb-12">
        <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">Artist profile</p>
        <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-none tracking-[-0.04em] text-white">About the Artist</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 line-clamp-3">{artistBio}</p>
      </section>
    </div>
  );
}
