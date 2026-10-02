import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function NewPlaylistScreen({ navigation, route }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { setUserPlaylists, userPlaylists } = usePlayer()
  const song = route.params?.song

  const createPlaylist = () => {
    const title = name.trim()
    if (!title) return
    const playlist = { id: `local-${Date.now()}`, name: title, description: description.trim(), image: song?.image || '', songs: song ? [song] : [], createdAt: new Date().toISOString() }
    setUserPlaylists([playlist, ...userPlaylists])
    navigation.goBack()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 18, paddingTop: 24 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Your collection</Text>
      <Text style={{ marginTop: 5, marginBottom: 24, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>New playlist</Text>
      <Text style={{ marginBottom: 7, color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Name</Text>
      <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="Give it a name" placeholderTextColor={colors.faint} style={{ height: 50, marginBottom: 17, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: typography.body }} />
      <Text style={{ marginBottom: 7, color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} maxLength={120} placeholder="Add a note (optional)" placeholderTextColor={colors.faint} multiline style={{ minHeight: 88, marginBottom: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: typography.body, textAlignVertical: 'top' }} />
      <Pressable disabled={!name.trim()} onPress={createPlaylist} style={{ height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: name.trim() ? colors.amber : '#493b2b' }}><Text style={{ color: '#21160a', fontFamily: typography.bodyBold }}>Create playlist</Text></Pressable>
    </View>
  )
}