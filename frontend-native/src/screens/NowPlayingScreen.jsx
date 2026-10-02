import { useEffect, useState } from 'react'
import { Image } from 'expo-image'
import Slider from '@react-native-community/slider'
import { ArrowDown, Heart, ListMusic, Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { apiClient } from '../api/client'
import { SongRow } from '../components/MusicCard'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

const tabs = ['UP NEXT', 'LYRICS', 'RELATED']
const formatTime = (seconds) => `${Math.floor((Number(seconds) || 0) / 60)}:${String(Math.floor((Number(seconds) || 0) % 60)).padStart(2, '0')}`

export default function NowPlayingScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('UP NEXT')
  const [lyrics, setLyrics] = useState('')
  const [lyricsCopyright, setLyricsCopyright] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const {
    currentTrack, queue, currentIndex, isPlaying, progress, duration, likedSongs,
    listenHistory, isShuffleEnabled, isRepeatEnabled, togglePlayback, playNext,
    playPrevious, toggleLike, isLiked, seekTo, setShuffleEnabled, setRepeatEnabled,
    playTrack,
  } = usePlayer()

  useEffect(() => {
    if (activeTab !== 'LYRICS' || !currentTrack?.id || currentTrack.hasLyrics !== true) {
      setLyrics('')
      setLyricsCopyright('')
      return undefined
    }
    let active = true
    setLyricsLoading(true)
    apiClient.get(`/songs/${encodeURIComponent(currentTrack.id)}/lyrics`).then((response) => {
      const data = response.data?.data
      if (!active) return
      setLyrics(typeof data?.lyrics === 'string' ? data.lyrics : '')
      setLyricsCopyright(data?.copyright || currentTrack.copyright || '')
    }).catch(() => { if (active) { setLyrics(''); setLyricsCopyright('') } }).finally(() => { if (active) setLyricsLoading(false) })
    return () => { active = false }
  }, [activeTab, currentTrack?.copyright, currentTrack?.hasLyrics, currentTrack?.id])

  if (!currentTrack) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}><ListMusic color={colors.muted} size={40} /><Text style={{ marginTop: 14, color: colors.text, fontFamily: typography.bodyBold, fontSize: 18 }}>Nothing playing</Text><Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12, padding: 10 }}><Text style={{ color: colors.amber, fontFamily: typography.bodyBold }}>Back to Autumn</Text></Pressable></View>
  }

  const nextSongs = queue.slice(currentIndex + 1)
  const related = [...likedSongs, ...listenHistory].filter((song) => String(song.id) !== String(currentTrack.id)).slice(0, 24)
  const artworkSize = 300

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 24 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Minimize player" onPress={() => navigation.goBack()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ArrowDown color={colors.text} size={23} /></Pressable>
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <View style={{ width: '100%', maxWidth: artworkSize, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, elevation: 18 }}>
            {currentTrack.image ? <Image source={{ uri: currentTrack.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} /> : null}
          </View>
          <View style={{ width: '100%', maxWidth: artworkSize, marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.displayBold, fontSize: 23 }}>{currentTrack.title}</Text><Text numberOfLines={1} style={{ marginTop: 4, color: colors.muted, fontFamily: typography.body, fontSize: 14 }}>{currentTrack.artist}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={isLiked(currentTrack.id) ? 'Unlike song' : 'Like song'} onPress={() => toggleLike(currentTrack)} style={{ padding: 10 }}><Heart color={isLiked(currentTrack.id) ? '#ef555b' : colors.muted} fill={isLiked(currentTrack.id) ? '#ef555b' : 'transparent'} size={23} /></Pressable>
          </View>
          <View style={{ width: '100%', maxWidth: artworkSize, marginTop: 20 }}>
            <Slider value={duration ? progress / duration : 0} minimumValue={0} maximumValue={1} minimumTrackTintColor={colors.text} maximumTrackTintColor="#4c4b49" thumbTintColor={colors.text} onSlidingComplete={(value) => seekTo(value * duration)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}><Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 11 }}>{formatTime(progress)}</Text><Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 11 }}>{formatTime(duration)}</Text></View>
          </View>
          <View style={{ width: '100%', maxWidth: 300, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setShuffleEnabled(!isShuffleEnabled)} accessibilityRole="button" accessibilityLabel="Toggle shuffle" style={{ padding: 10 }}><Shuffle color={isShuffleEnabled ? colors.amber : colors.muted} size={21} /></Pressable>
            <Pressable onPress={playPrevious} accessibilityRole="button" accessibilityLabel="Previous song" style={{ padding: 10 }}><SkipBack color={colors.text} size={25} fill={colors.text} /></Pressable>
            <Pressable onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'} style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: colors.text }}>{isPlaying ? <Pause color="#111" fill="#111" size={24} /> : <Play color="#111" fill="#111" size={24} />}</Pressable>
            <Pressable onPress={playNext} accessibilityRole="button" accessibilityLabel="Next song" style={{ padding: 10 }}><SkipForward color={colors.text} size={25} fill={colors.text} /></Pressable>
            <Pressable onPress={() => setRepeatEnabled(!isRepeatEnabled)} accessibilityRole="button" accessibilityLabel="Toggle repeat" style={{ padding: 10 }}><Repeat2 color={isRepeatEnabled ? colors.amber : colors.muted} size={21} /></Pressable>
          </View>
          <View style={{ width: '100%', maxWidth: artworkSize, marginTop: 26, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {tabs.map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === tab ? colors.amber : 'transparent' }}><Text style={{ color: activeTab === tab ? colors.text : colors.muted, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 0.8 }}>{tab}</Text></Pressable>)}
          </View>
          <View style={{ width: '100%', maxWidth: artworkSize, paddingTop: 12 }}>
            {activeTab === 'UP NEXT' && (nextSongs.length ? nextSongs.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, queue)} />) : <Text style={{ paddingVertical: 18, color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Your queue is empty.</Text>)}
            {activeTab === 'LYRICS' && (lyricsLoading ? <Text style={{ paddingVertical: 18, color: colors.muted, fontFamily: typography.body }}>Loading lyrics…</Text> : currentTrack.hasLyrics === true && lyrics ? <><Text style={{ paddingVertical: 14, color: colors.text, fontFamily: typography.body, fontSize: 15, lineHeight: 26 }}>{lyrics}</Text>{!!lyricsCopyright && <Text style={{ color: colors.faint, fontFamily: typography.body, fontSize: 11 }}>{lyricsCopyright}</Text>}</> : <Text style={{ paddingVertical: 18, color: colors.muted, fontFamily: typography.body }}>Lyrics are not available for this song.</Text>)}
            {activeTab === 'RELATED' && (related.length ? related.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, related)} />) : <Text style={{ paddingVertical: 18, color: colors.muted, fontFamily: typography.body }}>Play more music to build your recommendations.</Text>)}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}