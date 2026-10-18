import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Shuffle, Search, X, Pencil } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import PlaylistCard from '../components/cards/PlaylistCard';
import { searchPlaylists } from '../api/playlists';
import { usePlayer } from '../context/PlayerContext';
import { getBestAudioUrl, getBestImageUrl } from '../utils/mediaQuality';
import SongActionsMenu from '../components/common/SongActionsMenu';
import NowPlayingOverlay from '../components/common/NowPlayingOverlay';
import Loader from '../components/common/Loader';
import PlaylistCover from '../components/common/PlaylistCover';

const ImageWithFallback = ({ src, alt, className, fallback }) => (
  <img src={src || fallback} alt={alt} className={className} onError={(event) => { event.currentTarget.src = fallback; }} />
);

function RelatedPlaylistsRail({ playlists, onWheel }) {
  const railRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    if (event.target.closest('a')) return;
    dragRef.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft };
    rail.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active || !railRef.current) return;
    railRef.current.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  };

  const stopDragging = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="relative min-w-0">
      <div
        ref={railRef}
        onWheel={onWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={stopDragging}
        className="scrollbar-none flex w-full cursor-grab flex-nowrap gap-6 overflow-x-auto overscroll-x-contain px-4 pb-2 active:cursor-grabbing"
      >
        {playlists.map((relatedPlaylist) => (
          <PlaylistCard key={relatedPlaylist.id} playlist={relatedPlaylist} compact />
        ))}
      </div>
    </div>
  );
}

export default function PlaylistPage({ libraryOption = '' }) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack, userPlaylists, setUserPlaylists } = usePlayer();
  const { playlistId: encodedPlaylistId, playlistName: encodedPlaylistName } = useParams();
  const [playlistTitle, setPlaylistTitle] = useState('Playlist');
  const playlistRouteName = React.useMemo(() => {
  const rawValue = libraryOption || encodedPlaylistName || encodedPlaylistId || '';
    try {
      return decodeURIComponent(rawValue).trim();
    } catch {
      return String(rawValue || '').trim();
    }
  }, [encodedPlaylistId, encodedPlaylistName, libraryOption]);
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [relatedPlaylists, setRelatedPlaylists] = useState([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const mobileScrollContainerRef = useRef(null);
  const desktopScrollContainerRef = useRef(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
  const [isVibeShuffleMode, setIsVibeShuffleMode] = useState(false);
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistDescription, setEditPlaylistDescription] = useState('');
  const [editPlaylistImage, setEditPlaylistImage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadPlaylist = async () => {
      try {
        setIsLoadingSongs(true);
        setLoadError('');

        const localPlaylist = userPlaylists.find((item) => String(item.id) === String(encodedPlaylistId));
        if (localPlaylist) {
          const normalizedLocalSongs = (localPlaylist.songs || []).map((song) => ({
            id: song.id,
            title: song.name || song.title || 'Unknown Track',
            artist: Array.isArray(song.artists?.all || song.artists?.primary)
              ? (song.artists.all || song.artists.primary).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ')
              : song.artist || song.subtitle || 'Unknown Artist',
            image: getBestImageUrl(song.image || song.cover || song.thumbnail || []),
            audio: getBestAudioUrl(song.downloadUrl || song.audio),
            duration: Number(song.duration || song.more_info?.duration || 0) || 0,
            raw: song,
          }));

          if (!controller.signal.aborted) {
            setPlaylist(localPlaylist);
            setPlaylistTitle(localPlaylist.name || playlistRouteName || 'Playlist');
            setSongs(normalizedLocalSongs);
            setRelatedPlaylists([]);
          }
          return;
        }

        const response = await axiosInstance.get('/playlists', { params: { id: encodedPlaylistId, limit: 1000 }, signal: controller.signal });
        const data = response.data?.data;
        const normalized = (data?.songs || []).map((song) => ({
          id: song.id,
          title: song.name || song.title || 'Unknown Track',
          artist: (song.artists?.all || song.artists?.primary || []).map((artist) => artist?.name || artist?.title).filter(Boolean).join(', ') || 'Unknown Artist',
          image: getBestImageUrl(song.image) || null,
          audio: getBestAudioUrl(song.downloadUrl || song.audio || song.more_info?.encrypted_media_url) || null,
          duration: Number(song.duration || 0) || 0,
          raw: song
        }));
        if (!controller.signal.aborted) {
          setPlaylist(data || null);
          setPlaylistTitle(data?.name || playlistRouteName || 'Playlist');
          setSongs(normalized);

          try {
            const baseName = data?.name || playlistRouteName;
            const relatedQueries = [
              `${baseName} playlist`,
              `${baseName} songs`,
              'chill Hindi playlists',
              'latest Bollywood playlists',
              'romantic Hindi playlists',
              'party Hindi playlists',
              'travel Hindi playlists',
              'new Hindi music playlists',
              'lofi Hindi playlists',
              'popular Bollywood playlists'
            ];
            const relatedResults = await Promise.allSettled(
              relatedQueries.flatMap((query) => [
                searchPlaylists(query, 12, 0),
                searchPlaylists(query, 12, 1),
                searchPlaylists(query, 12, 2)
              ])
            );
            const unique = relatedResults
              .filter((result) => result.status === 'fulfilled')
              .flatMap((result) => result.value)
              .filter((item) => String(item.id) !== String(encodedPlaylistId))
              .filter((item, index, items) => items.findIndex((candidate) => String(candidate.id) === String(item.id)) === index)
              .slice(0, 8);
            if (!controller.signal.aborted) setRelatedPlaylists(unique);
          } catch {
            if (!controller.signal.aborted) setRelatedPlaylists([]);
          }
        }
      } catch {
        if (!controller.signal.aborted) setLoadError('Unable to load this playlist right now.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingSongs(false);
      }
    };
    loadPlaylist();
    return () => controller.abort();
  }, [encodedPlaylistId, playlistRouteName, userPlaylists]);

  const displayName = playlist?.name || playlistTitle || 'Playlist';
  const dailySongs = songs;
  const isLocalPlaylist = userPlaylists.some((item) => String(item.id) === String(encodedPlaylistId));

  const handleSavePlaylistDetails = (event) => {
    event.preventDefault();
    const name = editPlaylistName.trim();
    if (!name || !isLocalPlaylist) return;
    const updates = {
      name,
      description: editPlaylistDescription.trim(),
      image: editPlaylistImage.trim() || null,
    };
    setUserPlaylists((items) => items.map((item) => (
      String(item.id) === String(encodedPlaylistId) ? { ...item, ...updates } : item
    )));
    setPlaylist((current) => current ? { ...current, ...updates } : current);
    setPlaylistTitle(name);
    setIsEditingPlaylist(false);
  };

  const handleDeletePlaylist = () => {
    if (!isLocalPlaylist || !window.confirm(`Delete "${displayName}"?`)) return;
    setUserPlaylists((items) => items.filter((item) => String(item.id) !== String(encodedPlaylistId)));
    navigate('/library');
  };

  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) {
      return dailySongs;
    }
    const q = searchTerm.toLowerCase();
    const result = dailySongs.filter((song) => {
      const title = (song.title || '').toLowerCase();
      const artist = Array.isArray(song.artist) ? song.artist.join(' ').toLowerCase() : (song.artist || '').toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
    return result;
  }, [dailySongs, searchTerm]);

  const handleToggleShuffle = useCallback(() => {
    setIsVibeShuffleMode(prev => !prev);
  }, []);

  const handleRelatedWheel = useCallback((event) => {
    const container = event.currentTarget;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || container.scrollWidth <= container.clientWidth) return;

    container.scrollLeft += event.deltaY;
    event.preventDefault();
  }, []);


  const toggleSearch = useCallback(() => {
    setSearchOpen(v => {
      const next = !v;
      if (!next) setSearchTerm('');
      return next;
    });
  }, []);

  const formatDuration = useCallback((song) => {
    if (!song) return '0:00';
    const raw = song.duration ?? song.length ?? song.durationSeconds ?? song.totalTime ?? 0;
    const totalSeconds = Number(raw);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, []);

  const handleSelectSong = useCallback((songId) => {
    const queueSource = isVibeShuffleMode
      ? [...dailySongs].sort(() => Math.random() - 0.5)
      : dailySongs;

    const selectedIndex = queueSource.findIndex(s => String(s.id) === String(songId));

    if (queueSource[selectedIndex >= 0 ? selectedIndex : 0]) playTrack(queueSource[selectedIndex >= 0 ? selectedIndex : 0], queueSource);
  }, [dailySongs, isVibeShuffleMode, playTrack]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      try { searchInputRef.current.focus(); } catch {}
    }
  }, [searchOpen]);

  useEffect(() => {
    const updateHeaderState = () => {
      const containers = [mobileScrollContainerRef.current, desktopScrollContainerRef.current].filter(Boolean);
      if (containers.length === 0) return;

      const maxScrollTop = Math.max(
        window.scrollY || document.documentElement.scrollTop || 0,
        ...containers.map((container) => container.scrollTop || 0)
      );
      setIsHeaderExpanded(maxScrollTop < 50);
    };

    const containers = [mobileScrollContainerRef.current, desktopScrollContainerRef.current].filter(Boolean);
    containers.forEach((container) => {
      container.addEventListener('scroll', updateHeaderState);
    });
    window.addEventListener('scroll', updateHeaderState, { passive: true });

    updateHeaderState();

    return () => {
      containers.forEach((container) => {
        container.removeEventListener('scroll', updateHeaderState);
      });
      window.removeEventListener('scroll', updateHeaderState);
    };
  }, [isLoadingSongs]);

  const hasSongData = songs.length > 0;

  if (!encodedPlaylistId) {
    return <div className="p-8 text-center text-white">Playlist not found.</div>;
  }

  if (isLoadingSongs && !hasSongData) {
    return (
      <div className="grid h-full min-h-[50vh] place-items-center p-8 text-white">
        <Loader label="Loading playlist songs" />
      </div>
    );
  }

  if (!hasSongData && (loadError || !playlist)) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center p-8 text-center text-white">
        <div className="max-w-md rounded-2xl border border-gray-700 bg-[#0f0f0f]/80 p-8 shadow-xl">
          <p className="text-lg font-semibold">No songs available yet.</p>
          <p className="mt-2 text-sm text-gray-400">{loadError || 'This playlist has no matching tracks.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-0 min-w-0 md:hidden">
        <div className={`z-30 mb-0 flex items-center gap-3 transition-all duration-300 ${isHeaderExpanded ? 'relative h-14 opacity-100' : 'fixed inset-x-0 top-0 h-14 bg-[#0f0f0f]/95 px-3 opacity-100 shadow-lg backdrop-blur-md'}`}>
          <button type="button" onClick={() => navigate(-1)} className="hidden md:block p-2 rounded-full bg-[#0f0f0f] hover:bg-[#282828] shrink-0" aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
              {isHeaderExpanded ? <h1 className="flex-1" /> : <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-white">{displayName}</h1>}
              <div className="flex items-center gap-2">
                {dailySongs.length > 0 && (
                  <button onClick={toggleSearch} className="shrink-0 rounded-full bg-[#0f0f0f] p-2 transition-colors hover:bg-[#282828]" aria-label={searchOpen ? 'Close playlist search' : 'Search playlist songs'}>
                    {searchOpen ? <X size={18} /> : <Search size={18} />}
                  </button>
                )}
                {dailySongs.length > 0 && (
                  <button
                    onClick={handleToggleShuffle}
                    className={`shrink-0 rounded-full p-2 transition-all ${
                      isVibeShuffleMode ? 'bg-blue-900 shadow-lg shadow-red-500/50 animate-pulse' : 'bg-[#0f0f0f] hover:bg-[#5f5f5f]'
                    }`}
                    title={isVibeShuffleMode ? 'Shuffle is on - songs will play randomly' : 'Shuffle is off - click to turn on'}
                  >
                    <Shuffle size={20} className="text-white" />
                  </button>
                )}
          </div>
        </div>
        <div className="grow flex flex-col min-h-0 min-w-0">
          <div className={`shrink-0 transition-all duration-300 ${isHeaderExpanded ? 'bg-[#0f0f0f]/80 p-6' : 'bg-[#0f0f0f]/80 p-3'}`}>
            {isHeaderExpanded && dailySongs.length > 0 && (
              <div className="flex items-center">
                <PlaylistCover playlist={playlist} songs={dailySongs} alt={displayName} className="w-24 rounded-lg shadow-lg" />
                <div className="w-full mt-3">
                  <h2 className="text-2xl font-bold ml-5 leading-none tracking-tight text-white">{displayName}</h2>
                  <div className="mt-3 ml-5 flex items-center justify-start gap-5 md:gap-6">
                    {isLocalPlaylist && <button
                      type="button"
                      onClick={() => {
                        setEditPlaylistName(playlist?.name || playlistTitle || '');
                        setEditPlaylistDescription(playlist?.description || '');
                        setEditPlaylistImage(typeof playlist?.image === 'string' ? playlist.image : '');
                        setIsEditingPlaylist(true);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-[#282828]"
                      aria-label="Edit playlist details"
                      title="Edit playlist"
                    >
                      <Pencil size={20} />
                    </button>}
                    <button
                      onClick={() => {
                        if (dailySongs.length > 0) {
                          handleSelectSong(dailySongs[0].id);
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500"
                      aria-label={isPlaying ? 'Pause vibe playback' : 'Play vibe'}
                    >
                      {isPlaying ? <Pause className="h-5 w-5 fill-white text-white" /> : <Play className="ml-1 h-5 w-5 fill-white text-white" />}
                    </button>
                    <SongActionsMenu song={playlist || { id: encodedPlaylistId, name: displayName }} itemType="playlist" items={dailySongs} alwaysVisible onDelete={isLocalPlaylist ? handleDeletePlaylist : undefined} />
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
                  placeholder={`Search within ${displayName}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1f1f1f]/40 text-white rounded-full py-2 pl-10 pr-3 text-sm focus:outline-none focus:bg-[#1f1f1f]"
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
          <div ref={mobileScrollContainerRef} className="grow overflow-y-auto custom-scrollbar p-1 pt-5 pb-24">
          {filteredSongs.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {filteredSongs.map((song) => {
                const isActive = String(currentTrack?.id) === String(song.id) && isPlaying;
                return (
                  <div
                    key={song.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectSong(song.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSong(song.id);
                      }
                    }}
                    className="group relative cursor-pointer bg-[#0f0f0f]/50 p-1 transition-colors hover:bg-[#282828]/80"
                  >
                    <div className="relative flex gap-3 items-start min-w-0 w-full">
                      <div onClick={() => handleSelectSong(song.id)} className="cover-container relative cursor-pointer shrink-0 overflow-hidden rounded-md">
                        <ImageWithFallback
                          src={song.image}
                          alt={song.title}
                          className="w-12 h-12 rounded-md object-cover"
                          fallback={'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'}
                        />
                        {isActive && <NowPlayingOverlay />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden mr-6 mt-2">
                        <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-red-300' : 'text-white'}`}>{song.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '')}</p>
                      </div>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 shrink-0">
                        <SongActionsMenu song={song} queue={filteredSongs} alwaysVisible />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-10">
              <p className="text-lg">No songs found in {displayName}.</p>
              <p className="text-sm mt-2">Try uploading songs for this vibe.</p>
            </div>
          )}

          {relatedPlaylists.length > 0 && (
            <section className="mt-10 pb-8">
              <div className="mb-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">More to explore</p>
                <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-none text-white">Related Playlists</h2>
              </div>
              <RelatedPlaylistsRail playlists={relatedPlaylists} onWheel={handleRelatedWheel} />
            </section>
          )}
        </div>
      </div>
      </div>

      <div className="hidden md:flex md:h-[calc(100vh-10rem)] md:min-h-0 md:min-w-0 md:flex-none md:overflow-hidden md:flex-row">
        <div className="relative shrink-0 transition-all duration-300 bg-[#0f0f0f]/80 p-1 lg:w-107.5 lg:min-w-107.5 md:w-90 md:min-w-90 md:sticky md:top-0 md:h-full md:border-r md:border-gray-800 md:p-5">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-4 top-4 z-20 rounded-full bg-[#0f0f0f] p-2 hover:bg-[#282828]" aria-label="Go back">
            <ArrowLeft size={20} />
          </button>

          {dailySongs.length > 0 && (
            <div className="mt-4 md:mt-4 md:flex md:flex-col md:items-center md:text-center">
              <PlaylistCover playlist={playlist} songs={dailySongs} alt={displayName} className="w-56 rounded-xl shadow-lg md:w-64" />
              <div className="flex-1 mt-5 md:mt-5 md:w-full">
                <h2 className="text-2xl leading-none tracking-tight font-bold text-white lg:text-4xl md:text-2xl">{displayName}</h2>
                <div className="lg:mt-6 md:mt-1 flex items-center justify-center gap-5 md:gap-6 lg:gap-10">
                  {isLocalPlaylist && <button
                    type="button"
                    onClick={() => {
                      setEditPlaylistName(playlist?.name || playlistTitle || '');
                      setEditPlaylistDescription(playlist?.description || '');
                      setEditPlaylistImage(typeof playlist?.image === 'string' ? playlist.image : '');
                      setIsEditingPlaylist(true);
                    }}
                    className="inline-flex rounded-full p-2 text-white transition-colors hover:bg-[#282828]"
                    aria-label="Edit playlist details"
                    title="Edit playlist"
                  >
                    <Pencil size={23} />
                  </button>}
                  <button
                    onClick={() => {
                      if (dailySongs.length > 0) {
                        handleSelectSong(dailySongs[0].id);
                      }
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-red-500/40 transition-all hover:bg-blue-500 md:h-16 md:w-16"
                    aria-label={isPlaying ? 'Pause vibe playback' : 'Play vibe'}
                  >
                    {isPlaying ? <Pause className="h-7 w-7 fill-white text-white md:h-8 md:w-8" /> : <Play className="ml-1 h-7 w-7 fill-white text-white md:h-8 md:w-8" />}
                  </button>

                  <SongActionsMenu song={playlist || { id: encodedPlaylistId, name: displayName }} itemType="playlist" items={dailySongs} alwaysVisible onDelete={isLocalPlaylist ? handleDeletePlaylist : undefined} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 bg-[#0f0f0f]/80 px-4 py-2 pb-2 md:px-6 md:pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search songs in ${displayName}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1f1f1f]/40 text-white rounded py-2 pl-10 pr-10 text-sm focus:outline-none focus:bg-[#1f1f1f]"
                autoComplete="off"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div ref={desktopScrollContainerRef} className="flex-1 min-h-0 mt-2 overflow-y-auto overscroll-contain custom-scrollbar p-4 pb-28 md:p-4 md:pb-28">
            {filteredSongs.length > 0 ? (
              <div className="space-y-1 md:space-y-1 mr-8">
                {filteredSongs.map((song) => {
                  const isActive = String(currentTrack?.id) === String(song.id) && isPlaying;
                  return (
                    <div
                      key={song.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectSong(song.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectSong(song.id);
                        }
                      }}
                      className="group relative z-0 flex cursor-pointer items-center gap-1 overflow-visible rounded border-b border-gray-800 bg-[#0f0f0f]/50 px-1 py-1 pr-12 transition-colors hover:bg-[#282828]/80 md:gap-4 md:px-1 md:py-1 md:pr-14"
                    >
                      <div className="cover-container relative h-10 w-10 shrink-0 rounded overflow-hidden">
                        <ImageWithFallback
                          src={song.image}
                          alt={song.title}
                          className="h-10 w-10 rounded object-cover md:h-10 md:w-10"
                          fallback={'https://placehold.co/400x400/1F2937/FFFFFF?text=Music'}
                        />
                        {isActive && <NowPlayingOverlay />}
                      </div>

                      <div className="flex flex-1 items-center justify-between gap-3 overflow-hidden min-w-0">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="truncate text-sm font-semibold text-white md:text-base">{song.title}</div>
                          <div className="truncate text-xs text-gray-400 md:text-sm">{Array.isArray(song.artist) ? song.artist.join(', ') : (song.artist || '')}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-gray-300 md:text-sm mr-1">{formatDuration(song)}</span>
                          <SongActionsMenu song={song} queue={songs} tabletAlwaysVisible />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10">
                <p className="text-lg">No songs found in {displayName}.</p>
                <p className="text-sm mt-2">Try uploading songs for this vibe.</p>
              </div>
            )}

            {relatedPlaylists.length > 0 && (
              <section className="mt-10 pb-8">
                <div className="mb-5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">More to explore</p>
                  <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-none text-white">Related Playlists</h2>
                </div>
                <br />
                <RelatedPlaylistsRail playlists={relatedPlaylists} onWheel={handleRelatedWheel} />
              </section>
            )}
          </div>
        </div>
      </div>
      {isEditingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePlaylistDetails} role="dialog" aria-modal="true" aria-labelledby="edit-playlist-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-[#242424] p-5 text-white shadow-2xl sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 id="edit-playlist-title" className="text-xl font-bold">Edit playlist</h2>
              <button type="button" onClick={() => setIsEditingPlaylist(false)} aria-label="Close edit playlist dialog" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-5">
              <label className="block text-sm text-white/70">
                <span className="mb-2 block">Playlist name</span>
                <input autoFocus required maxLength={80} value={editPlaylistName} onChange={(event) => setEditPlaylistName(event.target.value)} className="w-full border-b border-white/20 bg-transparent px-0 py-3 text-base text-white outline-none focus:border-[#3ca9ff]" />
              </label>
              <label className="block text-sm text-white/70">
                <span className="mb-2 block">Description</span>
                <textarea rows={3} maxLength={240} value={editPlaylistDescription} onChange={(event) => setEditPlaylistDescription(event.target.value)} className="w-full resize-y rounded-md border border-white/15 bg-black/20 px-3 py-2 text-base text-white outline-none focus:border-[#3ca9ff]" />
              </label>
              <label className="block text-sm text-white/70">
                <span className="mb-2 block">Cover image URL</span>
                <input type="url" value={editPlaylistImage} onChange={(event) => setEditPlaylistImage(event.target.value)} placeholder="https://..." className="w-full border-b border-white/20 bg-transparent px-0 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-[#3ca9ff]" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditingPlaylist(false)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white">Cancel</button>
              <button type="submit" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#242424] hover:bg-white/85">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};