import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { getMoodSongs } from '../api/music'
import { SongRow } from '../components/MusicCard'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function MoodScreen({ route }) {
  const mood = route.params?.mood || 'Feel good'
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { playTrack } = usePlayer()

  useEffect(() => {
    let active = true
    setLoading(true)
    getMoodSongs(mood).then((items) => { if (active) setSongs(items) }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load this mood.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mood])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 100 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Your mood</Text>
      <Text style={{ marginTop: 5, marginBottom: 22, color: colors.text, fontFamily: typography.displayBold, fontSize: 30 }}>{mood}</Text>
      {loading && <ActivityIndicator color={colors.amber} />}
      {!!error && <Text style={{ color: colors.danger, fontFamily: typography.body }}>{error}</Text>}
      {!loading && songs.length === 0 && !error && <Text style={{ color: colors.muted, fontFamily: typography.body }}>No songs found for this mood.</Text>}
      {songs.map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, songs)} />)}
    </ScrollView>
  )
}