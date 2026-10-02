import { Pressable, ScrollView, Text, View } from 'react-native'
import { usePlayer } from '../player/PlayerContext'
import { SongRow } from '../components/MusicCard'
import { colors, typography } from '../theme/tokens'

export default function LocalPlaylistScreen({ route, navigation }) {
  const { userPlaylists, setUserPlaylists, playTrack } = usePlayer()
  const playlist = userPlaylists.find((item) => item.id === route.params?.playlistId)
  const songs = playlist?.songs || []

  const deletePlaylist = () => {
    setUserPlaylists(userPlaylists.filter((item) => item.id !== playlist?.id))
    navigation.goBack()
  }

  if (!playlist) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.muted, fontFamily: typography.body }}>Playlist not found.</Text></View>
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 100 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Your playlist</Text>
      <Text style={{ marginTop: 5, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>{playlist.name}</Text>
      {!!playlist.description && <Text style={{ marginTop: 6, color: colors.muted, fontFamily: typography.body }}>{playlist.description}</Text>}
      <View style={{ marginTop: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{songs.length} songs</Text><Pressable onPress={deletePlaylist} accessibilityRole="button"><Text style={{ color: colors.danger, fontFamily: typography.bodyBold, fontSize: 12 }}>Delete playlist</Text></Pressable></View>
      {songs.length ? songs.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, songs)} />) : <Text style={{ paddingVertical: 20, color: colors.muted, fontFamily: typography.body }}>Add songs from the player to build this playlist.</Text>}
    </ScrollView>
  )
}