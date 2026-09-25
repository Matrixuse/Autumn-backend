import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Home from '../pages/Home'
import Explore from '../pages/Explore'
import Library from '../pages/Library'
import PlaylistsPage from '../pages/PlaylistPage'
import AuthPage from '../pages/AuthPage'
import ArtistPage from '../pages/ArtistPage'
import AlbumsPage from '../pages/AlbumsPage'
import EquilizerPage from '../pages/EquilizerPage'
import FeedbackPage from '../pages/FeedbackPage'
import MoodChipsPage from '../pages/MoodChipsPage'
import KeepListening from '../pages/KeepListening'
import LikedSongPage from '../pages/LikedSongPage'
import RecentlyPlayed from '../pages/RecentlyPlayed'
import PlaylistsLibrary from '../pages/PlaylistsLibrary'
import NewPlaylist from '../pages/NewPlaylist'
import Profile from '../pages/Profile'
import SearchPage from '../pages/SearchPage'
import MobilePlayerPage from '../pages/MobilePlayerPage'

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/keep-listening" element={<KeepListening />} />
                <Route path="/now-playing" element={<MobilePlayerPage />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/library" element={<Library />} />
                <Route path="/liked-songs" element={<LikedSongPage />} />
                <Route path="/recently-played" element={<RecentlyPlayed />} />
                <Route path="/playlists" element={<PlaylistsLibrary />} />
                <Route path="/new-playlist" element={<NewPlaylist />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/playlist/:playlistId/:playlistName?" element={<PlaylistsPage />} />
                <Route path="/artist/:artistId/:artistName?" element={<ArtistPage />} />
                <Route path="/album/:albumId/:albumName?" element={<AlbumsPage />} />
                <Route path="/mood/:moodName" element={<MoodChipsPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/equalizer" element={<EquilizerPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}