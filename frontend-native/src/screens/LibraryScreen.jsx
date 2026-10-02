import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Clock3, Heart, ListMusic, Plus, Search } from 'lucide-react-native'
import { ImageCard } from '../components/MusicCard'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

const links = [
  { name: 'Liked music', detail: 'Songs you want to keep close', route: 'LikedSongs', icon: Heart, color: '#ef555b' },
  { name: 'Recently played', detail: 'Pick up where you left off', route: 'RecentlyPlayed', icon: Clock3, color: colors.teal },
  { name: 'Playlists', detail: 'Collections for every moment', route: 'Playlists', icon: ListMusic, color: colors.text },
]

export default function LibraryScreen({ navigation }) {
  const [search, setSearch] = useState('')
  const { userPlaylists } = usePlayer()
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? userPlaylists.filter((item) => `${item.name} ${item.description || ''}`.toLowerCase().includes(term)) : userPlaylists
  }, [search, userPlaylists])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120, gap: 22 }}>
      <View>
        <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Your space</Text>
        <Text style={{ marginTop: 5, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Library</Text>
      </View>
      <View style={{ gap: 8 }}>
        {links.map(({ name, detail, route, icon: Icon, color }) => (
          <Pressable key={route} onPress={() => navigation.navigate(route)} style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
            <Icon color={color} size={22} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontFamily: typography.bodyBold, fontSize: 15 }}>{name}</Text><Text style={{ marginTop: 4, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{detail}</Text></View>
            <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text, fontFamily: typography.displayBold, fontSize: 21 }}>Your playlists</Text>
        <Pressable onPress={() => navigation.navigate('NewPlaylist')} accessibilityRole="button" accessibilityLabel="Create playlist" style={{ padding: 7 }}><Plus color={colors.amber} size={22} /></Pressable>
      </View>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Search color={colors.muted} size={17} /><TextInput value={search} onChangeText={setSearch} placeholder="Search your playlists" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, fontFamily: typography.body, fontSize: 14 }} />
      </View>
      {filtered.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>{filtered.map((item) => <ImageCard key={item.id} width={155} image={item.image} title={item.name} subtitle={`${item.songs?.length || 0} songs`} onPress={() => navigation.navigate('LocalPlaylist', { playlistId: item.id })} />)}</View> : <Text style={{ paddingVertical: 12, color: colors.muted, fontFamily: typography.body }}>{search.trim() ? 'No playlists match your search.' : 'Your playlists will appear here.'}</Text>}
    </ScrollView>
  )
}