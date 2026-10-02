import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native'
import { getCollectionSongs } from '../api/music'
import { SongRow } from '../components/MusicCard'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function CollectionScreen({ route }) {
  const { id, name, image, description, type = 'playlist', songs: initialSongs } = route.params || {}
  const [songs, setSongs] = useState(Array.isArray(initialSongs) ? initialSongs : [])
  const [loading, setLoading] = useState(!initialSongs?.length)
  const [error, setError] = useState('')
  const { playTrack } = usePlayer()

  useEffect(() => {
    if (initialSongs?.length) return undefined
    let active = true
    getCollectionSongs(type, id).then((items) => { if (active) setSongs(items) }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load this collection.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, initialSongs, type])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 100 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 22 }}>
        {image ? <Image source={{ uri: image }} style={{ width: 110, height: 110, borderRadius: 9, backgroundColor: colors.elevated }} /> : <View style={{ width: 110, height: 110, borderRadius: 9, backgroundColor: colors.surface }} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase' }}>{type}</Text>
          <Text numberOfLines={2} style={{ marginTop: 5, color: colors.text, fontFamily: typography.displayBold, fontSize: 23 }}>{name || 'Collection'}</Text>
          {!!description && <Text numberOfLines={2} style={{ marginTop: 5, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{description}</Text>}
        </View>
      </View>
      {loading && <ActivityIndicator color={colors.amber} />}
      {!!error && <Text style={{ color: colors.danger, fontFamily: typography.body }}>{error}</Text>}
      {!loading && songs.length === 0 && !error && <Text style={{ color: colors.muted, fontFamily: typography.body }}>No playable tracks in this collection.</Text>}
      {songs.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, songs)} />)}
    </ScrollView>
  )
}