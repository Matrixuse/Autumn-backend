# Autumn Native Port: Phase 0 Audit

**Scope:** source-of-truth audit of the mobile web experience in `frontend/`. This phase creates documentation only; no app code or web/backend files are changed.

## App Shell and Access

- Web entry is `src/App.jsx`: `BrowserRouter` wraps `PlayerProvider`, then `AuthProvider`, then `AppRoutes`.
- `AppLayout` provides a desktop sidebar, responsive top bar, fixed mini-player and bottom mobile tabs. On `/now-playing`, the mobile layout hides the top bar, mini-player and bottom tabs; the dedicated full-screen player takes over.
- `ProtectedRoute` exists but is not mounted in `AppRoutes`. Instead, `AppLayout` overlays most signed-out routes with a login/register prompt. `/keep-listening` is exempt from that overlay.
- Web API base is `VITE_API_BASE_URL`, normalized to end in `/api`; without it, requests use relative `/api`. Axios sends `withCredentials: true`. The native target should use the requested `EXPO_PUBLIC_API_URL` and explicit persisted auth credentials only if the backend supports them; the web implementation does not establish a bearer-token contract.
- No Expo project files or `frontend-native/assets/logo-source.png` exist yet. The web does contain branding assets under `frontend/public/` (`logo2.png`, PWA icons, and liked-song art); confirm whether one is the intended native logo source before Phase 1 asset generation.

## Routes and Screens

| Route | Screen and mobile behavior | Main screen components |
|---|---|---|
| `/login` | Email/password login; Google sign-in appears only in login mode. | `AuthPage`, `ArtPanel`, `Loader` |
| `/signup` | Username, email and password registration; no Google registration button. | `AuthPage`, `ArtPanel`, `Loader` |
| `/` | Home sections; mobile order starts with moods, Quick picks, Listen again, Library, mixes, artists, albums, moods, Hollywood Vibes and long-form picks. | `MoodChips`, `QuickPicks`, `ListenAgain`, `Library`, `MixForYou`, `PopularArtists`, `Albums`, `Moods`, `Hollywood`, `LongToListen`, `Footer` |
| `/keep-listening` | Queue, lyrics and related tabs; queue rows can be reordered. The main layout is a split artwork/details view and is not a dedicated narrow-phone design. | `KeepListening`, `SortableQueueList`, `SongActionsMenu`, `NowPlayingOverlay`, `Loader`, `useLyrics` |
| `/now-playing` | Full-screen mobile player with artwork, title/artist, seek bar, like, shuffle/repeat, previous/play/next, and a draggable details sheet with tabs. | `MobilePlayerPage`, `SortableQueueList`, `MoodChips`, `SongCard`, `ArtistCard`, `PlaylistCard`, `SongActionsMenu`, `NowPlayingOverlay`, `Loader`, `useLyrics` |
| `/explore` | “For you” discovery: mood chips, fresh discoveries, albums, mixes and Hollywood Vibes. | `Explore`, `MoodChips`, `SongCard`, `Albums`, `MixForYou`, `Hollywood`, `Loader` |
| `/search` | Search page shows recent searches or search results; on narrow screens the results list is on the page while suggestions are handled by the shared search state. | `SearchPage`, shared `SearchBar`, `NowPlayingOverlay` |
| `/library` | Liked music, playlist and recently-played links; locally created playlist list and filter. | `Library`, `MoodChips`, `Avatar` |
| `/liked-songs` | Liked list, play all, shuffle all, filter/search, row actions and compact sticky header. | `LikedSongPage`, `SongActionsMenu`, `NowPlayingOverlay` |
| `/recently-played` | Local listening history, play all/shuffle and song cards. | `RecentlyPlayed`, `SongCard` |
| `/playlists` | Browse public mood-based playlist rails; this is not the user's custom playlist manager. | `PlaylistsLibrary`, `PlaylistCard`, `Loader`, `Avatar` |
| `/new-playlist` | Modal to create a local playlist or add the passed song to a local playlist. | `NewPlaylist` |
| `/playlist/:playlistId/:playlistName?` | Public playlist detail or local playlist detail, songs, search, actions and related public playlist rail. Route mounts `PlaylistPage`, a wrapper around `PlaylistsPage`. | `PlaylistPage`, `PlaylistsPage`, `PlaylistCard`, `SongActionsMenu`, `NowPlayingOverlay`, `Loader` |
| `/artist/:artistId/:artistName?` | Artist songs and album sections with search and playback. | `ArtistPage`, `QuickPicks`, `Albums`, `SongActionsMenu`, `NowPlayingOverlay`, `Loader` |
| `/album/:albumId/:albumName?` | Album artwork/details, searchable songs, related picks and releases. | `AlbumsPage`, `QuickPicks`, `Albums`, `SongActionsMenu`, `NowPlayingOverlay`, `Loader` |
| `/mood/:moodName` | Mood songs, related artists and playlists. | `MoodChipsPage`, `MoodChips`, `QuickPicks`, `Moods`, `PopularArtists`, `MixForYou`, `Loader` |
| `/profile` | Username/email edit form. | `Profile`, `Avatar` |
| `/feedback` | Feedback screen; feedback is stored in browser storage. | `FeedbackPage` |
| `/equalizer` | Equalizer controls. | `EquilizerPage` |
| `*` | Redirects to `/`. | React Router `Navigate` |

`PlaylistDetail.jsx` is present but is not the component mounted by the playlist route. Shared shell components are `AppLayout`, `Topbar`, `Sidebar`, `MobileNav`, `SearchBar` and `PlayerBar`. Reusable content components also include `SongCard`, `ArtistCard`, `PlaylistCard`, `NowPlayingOverlay`, `Loader`, `Button`, `Avatar`, `SongActionsMenu`, `VolumeControl`, and the section components named above.

## Web-to-Native Component Map

| Web component / behavior | Planned native component |
|---|---|
| `AppRoutes` and `AppLayout` | React Navigation native stack + bottom tabs; shared safe-area shell |
| `Topbar`, `Sidebar`, `MobileNav` | Native header/menu and bottom tab navigator |
| `SearchBar` + `SearchPage` | Search screen with debounced grouped suggestion list and filter controls |
| `Home` + section rails | ScrollView/FlatList home sections with horizontal native lists |
| `SongCard`, `ArtistCard`, `PlaylistCard` | Cached-image native cards; pressable rows/cards keyed by source `id` |
| `PlayerBar` | Persistent mini-player above bottom tabs |
| `MobilePlayerPage` | Full Now Playing stack screen and native bottom sheet/details tabs |
| `KeepListening` + `SortableQueueList` | Now Playing “UP NEXT” tab with `react-native-draggable-flatlist` |
| `SongActionsMenu` | Native bottom-sheet action menu and platform share sheet |
| Web Audio element + `useAudioPlayer` | `react-native-track-player`, registered playback service and Android media notification |
| `AuthContext` + browser `localStorage` | Auth store/context plus SecureStore and AsyncStorage; native Google Sign-In |
| `useLyrics` | Native lyrics tab with conditional request and preserved line breaks |
| Web CSS animations/gestures | Reanimated + Gesture Handler, respecting system reduced-motion/accessibility settings |

## API Surface

All paths below are relative to the configured API base, which the web normalizes to include `/api`. No likes, custom-playlist mutation, listen-history write, or profile-update endpoint is called by the current frontend.

| Method and path | Parameters/body | Usage |
|---|---|---|
| `POST /auth/login` | JSON credentials: `{ email, password }` | Login |
| `POST /auth/register` | JSON credentials: `{ username, email, password }` | Registration |
| `POST /auth/google` | `{ idToken }` | Google login only; web gets token from Google Identity Services |
| `GET /auth/profile` | None | API helper exists but current auth initialization does not call it |
| `POST /auth/logout` | None | Logout; web Axios sends cookies |
| `GET /search/songs` | `query`, `page`, `limit` | Search suggestions, search selection, home/discovery/mood searches, queue related/popular searches, and song lookup helpers |
| `GET /search/artists` | `query`, `page`, `limit` | Search suggestions, home artist lookup, related/mood artists, artist resolution |
| `GET /search/albums` | `query`, `page`, `limit` | Album discovery and release rails |
| `GET /search/playlists` | `query`, `page`, `limit` | Search suggestions, mood playlist rails, related playlists, recommendation rails |
| `GET /search` | `query` | `searchAll` helper exists; no current screen call site found |
| `GET /songs/{id}` | ID in path | Song details, curated Hollywood ID lookup, stream URL helper |
| `GET /songs/{id}/suggestions` | `limit=20` | First source in Up Next candidate builder |
| `GET /songs/{id}/lyrics` | ID in path | Called only when the lyrics tab is active and `song.hasLyrics === true` |
| `GET /artists/{id}/songs` | `page=0`, `limit=500`, `sortBy=popularity`, `sortOrder=desc` | Artist detail |
| `GET /artists/{id}/albums` | `page=0`, `sortBy=popularity`, `sortOrder=desc` | Artist detail |
| `GET /albums` | `id`; queue/action lookup also sends `limit=1000` | Album detail and add-collection-to-queue action |
| `GET /playlists` | `id`; queue/action lookup sends `limit=1000` | Public playlist detail and add-collection-to-queue action |

Query examples are composed from the current user's local listening language/history (for example trending/latest language searches), mood terms, fixed artist names, and album/playlist names. Search requests for suggestions are debounced by 220 ms and request 20 songs, 3 artists and 2 playlists. Despite the broad placeholder, the live dropdown currently does not request albums or render explicit type-group headings.

## Global State and Persistence

`PlayerProvider` owns `currentTrack`, ordered `queue`, `currentIndex`, queue loading, `isPlaying`, `progress`, `duration`, `volume`, boolean shuffle/repeat, and local collections. It also coordinates browser Media Session metadata/actions. `AuthProvider` owns `user`, `loading` (initialized false), login/register/Google/logout and a local profile updater.

Browser storage keys include `autumn_user`, `autumn_listen_history` (deduplicated, newest first, maximum 18), `autumn_liked_songs`, `autumn_user_playlists`, `autumn_listen_again`, `autumn_not_interested`, `autumn_search_history`, and daily/rotating home caches. Likes and custom playlists are changed locally only. Logout stops playback and removes the local user. `GET /auth/profile` exists but is not used for cold-start verification; web auto-login is only the cached user object.

## Player and Queue Rules

- Web audio is a single HTML `<audio>` element with progress, duration, seek and volume state. It does not provide Android background playback or notification controls.
- The mini-player is fixed above the mobile tab bar and supports swipe-up/open to `/now-playing`; Now Playing has a down-swipe/minimize gesture, cover art, song/artist, like, progress/time, shuffle, repeat, previous/next/play and an expandable details sheet.
- Repeat is a boolean: when enabled, the current song restarts on end. There is no repeat-all mode. Shuffle is a boolean; it keeps the displayed queue order and selects a random not-yet-played queue item on `next()`. Once all queue IDs have played, it stops rather than starting another shuffle cycle. Previous remains index-based, not a history of shuffled playback.
- Playing a track already in `queue` moves the current pointer without rebuilding. Playing a track outside the queue starts a new queue and asynchronously requests up to 50 tracks. Current `playTrack` ignores the optional list argument used by several cards; it regenerates recommendations for an outside-queue track rather than adopting that passed list.
- Queue builder keeps the source song first, progressively publishes results, filters duplicate normalized titles, caps at one per title and two per artist, and locks to English when the source track is English. Candidate sources are suggestions (with artist search as an additional suggestions fallback when fewer than 10 are returned), local listening history, album/title-language related search, then popular language searches. Fisher-Yates shuffles only the supplemental pool. Diversity/language filtering can leave fewer than 50 tracks.
- Tapping a queue row selects that exact queued item. Drag reorder updates `currentIndex` by the currently playing track's ID so reorder does not change the active song.
- Song normalization generally spreads the original payload and adds display/audio fields, but some screen helpers reduce data to view models or keep it under `raw`; exact-object preservation should be deliberate in native state and queue actions.
- Listening history is updated when a track is selected/advanced, not sent to the backend. The web does not record a separate completed-play event.

## Search, Lyrics, Artist Names, and Media

- `utils/songSearch.js` normalizes title text; exact title scores 1000, substring 500, partial query-word overlap up to 250, artist match +400 and relative play count up to +25. It filters noise titles (`slowed`, `sped up`, `nightcore`, `reverb`, `extended`, `remix`, `8d`, `lofi`, `cover`, `tribute`, `instrumental`, `karaoke`, `mashup`, `bass boosted`) when clean results exist. These best-match helpers are not wired into the shared live `SearchBar` suggestion fetch, which currently displays raw service results.
- `recommendationQueue.js` title normalization removes bracketed/version suffixes and normalizes punctuation. The artist helper prefers `artists.primary[0]`, then `artists.all[0]`, then string fields. Other screen code uses inconsistent artist fallbacks; native UI should render names, never raw artist objects, and use `artists.primary` as required.
- Lyrics request requires both active lyrics tab and strict `hasLyrics === true`; loading, unavailable text, preserved line breaks and copyright text are handled.
- Web media helper chooses the highest numeric audio quality/bitrate and the largest-looking image URL; it does not guarantee 160 kbps preference or specifically prefer the 500x500 image variant. Native implementation should follow the requested 160 -> 320 -> first audio fallback and 500x500 image preference instead.

## Visual and Interaction Tokens

- Fonts: DM Sans body; Space Grotesk headings; Bahnschrift Condensed branding. Web loads DM Sans and Space Grotesk from Google Fonts; a native font-loading/local-font strategy is needed.
- Main shell is near-black (`#050505` / `#0d0e0c`) with subtle teal upper-left and olive/brown upper-right radial glows. Now Playing is black; queue surfaces use `#101010` to `#202020`.
- Primary text `#f7f4ee`/white, muted text around white 40-60%; warm amber `#e6a44a` and eyebrow amber `#d29a55`; blue/violet active player controls include `#5b7cff` and `#8ba3ff`. Borders are low-contrast white at roughly 4-15% opacity.
- Mobile shell uses 16 px page gutters, compact vertical gaps (about 20 px between sections), horizontally scrolling mood chips and rails, square/circular cover art, truncated single-line metadata, and a 60 px bottom tab bar plus safe-area inset. Mini-player is roughly 68 px high above tabs. Now Playing cover is square, max 320 px, with 24 px side padding; controls are large touch targets.
- Lucide icons are used throughout (Home, Search, Library, ListMusic, Shuffle, Repeat2, playback arrows, ThumbsUp, etc.).
- Motion includes a 180 ms overlay fade, 280 ms action sheet entrance, 450 ms queue reveal, pulsing playback bars, and drag/swipe transforms. Native alternatives should preserve intent without making essential controls gesture-only.
- Loading, empty and error states exist on most data screens. Home has per-section errors; Explore and detail screens have loading/empty/error variants. The web has no general pull-to-refresh interaction; refresh behavior will be a native addition where useful.

## Known Gaps and Native Alternatives

| Web limitation / browser-only behavior | Native plan or parity note |
|---|---|
| No backend endpoints/calls for likes, custom playlists, history, or profile edits; custom playlist create/add is local only. Playlist service create/get/delete exports currently throw TODO errors. | Confirm backend contracts before claiming MongoDB parity; keep API work behind typed service methods and expose failures clearly. |
| Cached web auth user is not validated on startup; Axios uses credential cookies and no explicit auth token. | Confirm backend's mobile auth/session mechanism. Persist only the supported credential securely and refresh the profile at startup. |
| Google sign-in uses browser Google Identity Services and is login-only. | Use `@react-native-google-signin/google-signin` and the same backend `/auth/google` `{ idToken }` contract, subject to native OAuth client configuration. |
| PWA install prompt, browser share/clipboard, DOM portals, hover menus, and pointer/keyboard drag sensors have no direct native equivalent. | Native install is platform-managed; use OS Share API, native bottom sheets, visible pressable action controls, and touch-first draggable list. |
| HTML Audio/Media Session and browser seek state are not Android background playback. | Use Track Player service, Android notification/lock-screen controls, audio focus, native progress events and seek actions. |
| Web's album detail shuffle button and some public playlist detail buttons are visual/no-op; local playlist rename/delete management is absent. | Do not imitate dead controls; implement them only when the native phase defines their behavior and persistence contract. |
| `/now-playing` related-artist code references `axiosInstance` without importing it in `MobilePlayerPage.jsx`, so that related fetch path is currently broken. | Native related fetch should use the typed API client and independent loading/error/empty states. |
| Web `getBestImageUrl`/`getBestAudioUrl` policies differ from the native quality rules requested. | Implement the requested 500x500 and 160 -> 320 -> first policies explicitly. |

## Phase 0 Verification

- At audit time, `frontend-native/` had no Expo project/package configuration; Phase 0 itself made no app-code changes.

## Phase 1 Foundation

- Scaffolded an Android-only Expo SDK 57 JavaScript app with NativeWind, React Navigation (five mobile tabs plus an auth stack), safe-area and gesture roots, dark theme tokens, bundled DM Sans/Space Grotesk fonts, and splash/adaptive icon config. `assets/logo-source.png` is copied from the existing web PWA mark because the requested source file did not exist.
- Added `.env.example`, Expo environment-based API origin handling, Axios credentialed requests and normalized API errors, backend-shaped login/register/Google/profile/logout methods, and SecureStore cached-profile restore. The backend sets an HttpOnly `jiosaavn_session` cookie and does not return a bearer token; startup validates it with `/auth/profile`.
- Login/register UI supports server-side validation errors, password visibility, loading states, and the native Google sign-in flow when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is configured. Authenticated tabs remain placeholders pending browse/player phases.
- Verification: `npx expo install --check` passes and `npx expo export --platform android` successfully bundles the app. `npx expo run:android` completed Expo prebuild but could not install/launch because there is no connected device or AVD. `assembleDebug` is still blocked by this machine's Android SDK setup/network: Gradle 9.3.1 cannot resolve a Google Maven dependency over Java TLS; cached Gradle 9.6 is incompatible with the Expo/Kotlin plugin. The build could not be declared successful.
- Manual testing remains pending until an emulator or Android device is available: login, registration, Google login with configured OAuth IDs, cold-start session restore, offline startup behavior, logout, and auth error messages. Phase 2 has not started.
