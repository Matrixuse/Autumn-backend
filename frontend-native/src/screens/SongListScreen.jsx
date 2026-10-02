import { Pressable, ScrollView, Text, View } from 'react-native'
import { Play, Shuffle } from 'lucide-react-native'
import { SongRow } from '../components/MusicCard'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function SongListScreen({ route }) {
  const { title = 'Songs', kind = 'liked', songs: initialSongs } = route.params || {}
  const { likedSongs, listenHistory, playTrack } = usePlayer()
  const songs = initialSongs || (kind === 'recent' ? listenHistory : likedSongs)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Your music</Text>
      <Text style={{ marginTop: 5, marginBottom: 16, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>{title}</Text>
      {songs.length > 0 && <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <Pressable onPress={() => playTrack(songs[0], songs)} style={{ height: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.amber }}><Play size={17} color="#21160a" fill="#21160a" /><Text style={{ color: '#21160a', fontFamily: typography.bodyBold }}>Play all</Text></Pressable>
        <Pressable onPress={() => playTrack(songs[Math.floor(Math.random() * songs.length)], songs)} style={{ height: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.border }}><Shuffle size={17} color={colors.text} /><Text style={{ color: colors.text, fontFamily: typography.bodyBold }}>Shuffle</Text></Pressable>
      </View>}
      {!songs.length && <Text style={{ marginTop: 10, color: colors.muted, fontFamily: typography.body }}>{kind === 'recent' ? 'Songs you play will appear here.' : 'Songs you like will appear here.'}</Text>}
      {songs.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, songs)} />)}
    </ScrollView>
  )
}