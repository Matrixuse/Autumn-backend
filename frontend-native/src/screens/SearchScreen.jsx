import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Clock3, Search, Trash2 } from 'lucide-react-native'
import { searchAlbums, searchArtists, searchPlaylists, searchSongs } from '../api/music'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'
import { ImageCard, SongRow } from '../components/MusicCard'

const categories = ['Songs', 'Artists', 'Albums', 'Playlists']
const HISTORY_KEY = 'autumn_search_history'

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Songs')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const { playTrack } = usePlayer()

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((value) => {
      if (value) setHistory(JSON.parse(value))
    }).catch(() => {})
  }, [])

  const rememberSearch = (value) => {
    const term = String(value || '').trim()
    if (!term) return
    const next = [term, ...history.filter((item) => item !== term)].slice(0, 10)
    setHistory(next)
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {})
  }

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); setError(''); return undefined }
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const loaders = { Songs: searchSongs, Artists: searchArtists, Albums: searchAlbums, Playlists: searchPlaylists }
        const items = await loaders[category](term, 24)
        if (active) setResults(items)
      } catch (requestError) {
        if (active) setError(requestError.message || 'Search is unavailable right now.')
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [category, query])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120 }}>
        <Text style={{ color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Search</Text>
        <View style={{ height: 48, marginTop: 18, marginBottom: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Search size={18} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Songs, artists, albums" placeholderTextColor={colors.faint} returnKeyType="search" style={{ flex: 1, color: colors.text, fontFamily: typography.body, fontSize: 15 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {categories.map((item) => {
            const active = category === item
            return <Pressable key={item} onPress={() => setCategory(item)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: active ? colors.amber : colors.surface }}><Text style={{ color: active ? '#21160a' : colors.muted, fontFamily: typography.bodyBold, fontSize: 12 }}>{item}</Text></Pressable>
          })}
        </ScrollView>
        {loading && <ActivityIndicator color={colors.amber} style={{ marginTop: 16 }} />}
        {!!error && <Text style={{ marginTop: 12, color: colors.danger, fontFamily: typography.body }}>{error}</Text>}
        {!query.trim() && history.length > 0 && <View style={{ marginTop: 4 }}>
          <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: colors.muted, fontFamily: typography.bodyBold, fontSize: 13 }}>Recent searches</Text><Pressable onPress={() => { setHistory([]); AsyncStorage.removeItem(HISTORY_KEY).catch(() => {}) }} accessibilityRole="button" accessibilityLabel="Clear search history" style={{ padding: 6 }}><Trash2 color={colors.muted} size={17} /></Pressable></View>
          {history.map((term) => <Pressable key={term} onPress={() => setQuery(term)} style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Clock3 color={colors.faint} size={16} /><Text style={{ color: colors.text, fontFamily: typography.body, fontSize: 14 }}>{term}</Text></Pressable>)}
        </View>}
        {!loading && query.trim().length >= 2 && results.length === 0 && !error && <Text style={{ marginTop: 20, color: colors.muted, fontFamily: typography.body }}>No {category.toLowerCase()} found.</Text>}
        {category === 'Songs' ? results.map((song) => <SongRow key={song.id} song={song} onPress={() => { rememberSearch(query); playTrack(song, results) }} />) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>
            {results.map((item) => <ImageCard key={item.id} width={150} image={item.image} title={item.name} subtitle={item.description} circular={category === 'Artists'} onPress={() => { rememberSearch(query); navigation.navigate('Collection', { ...item, type: category === 'Artists' ? 'artist' : category === 'Albums' ? 'album' : 'playlist' }) }} />)}
          </View>
        )}
      </ScrollView>
    </View>
  )
}