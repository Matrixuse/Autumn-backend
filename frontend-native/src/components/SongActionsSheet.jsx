import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Ellipsis, Heart, ListPlus, Plus } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function SongActionsSheet({ song }) {
  const [visible, setVisible] = useState(false)
  const navigation = useNavigation()
  const { isLiked, toggleLike, addToQueue, userPlaylists, setUserPlaylists } = usePlayer()

  const addToPlaylist = (playlist) => {
    setUserPlaylists(userPlaylists.map((item) => item.id === playlist.id && !item.songs?.some((track) => String(track.id) === String(song.id))
      ? { ...item, songs: [...(item.songs || []), song] }
      : item))
    setVisible(false)
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${song.title}`} onPress={() => setVisible(true)} hitSlop={8} style={{ padding: 8 }}><Ellipsis color={colors.muted} size={19} /></Pressable>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable onPress={() => setVisible(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.64)' }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#171817' }}>
            <Text numberOfLines={1} style={{ marginBottom: 15, color: colors.text, fontFamily: typography.bodyBold, fontSize: 16 }}>{song.title}</Text>
            <Text numberOfLines={1} style={{ marginBottom: 12, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{song.artist}</Text>
            <Action label={isLiked(song.id) ? 'Remove from liked music' : 'Add to liked music'} icon={Heart} onPress={() => { toggleLike(song); setVisible(false) }} />
            <Action label="Add to queue" icon={ListPlus} onPress={() => { addToQueue(song); setVisible(false) }} />
            {userPlaylists.map((playlist) => <Action key={playlist.id} label={`Add to ${playlist.name}`} icon={Plus} onPress={() => addToPlaylist(playlist)} />)}
            <Action label="Create playlist with this song" icon={Plus} onPress={() => { setVisible(false); navigation.navigate('NewPlaylist', { song }) }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function Action({ label, icon: Icon, onPress }) {
  return <Pressable onPress={onPress} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 13 }}><Icon color={colors.text} size={19} /><Text style={{ color: colors.text, fontFamily: typography.body, fontSize: 14 }}>{label}</Text></Pressable>
}