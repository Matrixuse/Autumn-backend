import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { searchPlaylists } from '../api/music'
import { ImageCard } from '../components/MusicCard'
import { colors, typography } from '../theme/tokens'

const playlistQueries = ['romantic songs playlist', 'party songs playlist', 'chill songs playlist', 'sad songs playlist', 'workout songs playlist', 'night drive songs playlist']

export default function PlaylistsScreen({ navigation }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all(playlistQueries.map((query) => searchPlaylists(query, 5).catch(() => []))).then((batches) => {
      const unique = [...new Map(batches.flat().map((item) => [item.id, item])).values()]
      if (active) setItems(unique)
    }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load playlists.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Browse by feeling</Text>
      <Text style={{ marginTop: 5, marginBottom: 20, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Playlists</Text>
      {loading && <ActivityIndicator color={colors.amber} />}
      {!!error && <Text style={{ color: colors.danger, fontFamily: typography.body }}>{error}</Text>}
      {!loading && items.length === 0 && !error && <Text style={{ color: colors.muted, fontFamily: typography.body }}>No playlists found.</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>
        {items.map((item) => <ImageCard key={item.id} width={160} image={item.image} title={item.name} subtitle={item.description} onPress={() => navigation.navigate('Collection', { ...item, type: 'playlist' })} />)}
      </View>
    </ScrollView>
  )
}