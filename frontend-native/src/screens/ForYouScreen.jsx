import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { getHomeFeed } from '../api/music'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'
import { ImageCard, SongRow } from '../components/MusicCard'

const sections = [
  ['Fresh discoveries', 'newReleases'],
  ['Mix for you', 'playlists'],
  ['Popular artists', 'artists'],
  ['Albums for you', 'albums'],
]

export default function ForYouScreen({ navigation }) {
  const { listenHistory, playTrack } = usePlayer()
  const [feed, setFeed] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getHomeFeed(listenHistory).then((result) => { if (active) setFeed(result) }).catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [listenHistory])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 120, gap: 28 }}>
      <View>
        <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Picked for you</Text>
        <Text style={{ marginTop: 5, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Explore</Text>
      </View>
      {!feed && !error && <ActivityIndicator color={colors.amber} />}
      {!!error && <Text style={{ color: colors.muted, fontFamily: typography.body }}>{error}</Text>}
      {sections.map(([title, key]) => {
        const items = feed?.[key] || []
        return (
          <View key={key}>
            <Text style={{ marginBottom: 14, color: colors.text, fontFamily: typography.displayBold, fontSize: 22 }}>{title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {items.map((item) => {
                const isSong = key === 'newReleases'
                return <ImageCard key={item.id} image={item.image} title={isSong ? item.title : item.name} subtitle={isSong ? item.artist : item.description} circular={key === 'artists'} onPress={() => isSong ? playTrack(item, items) : navigation.navigate('Collection', { ...item, type: key === 'artists' ? 'artist' : key === 'albums' ? 'album' : 'playlist' })} />
              })}
            </ScrollView>
          </View>
        )
      })}
      {feed?.quickPicks?.length > 0 && <View><Text style={{ marginBottom: 12, color: colors.text, fontFamily: typography.displayBold, fontSize: 22 }}>Quick picks</Text>{feed.quickPicks.slice(0, 8).map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, feed.quickPicks)} />)}</View>}
    </ScrollView>
  )
}