import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { UserRound } from 'lucide-react-native'
import { useAuth } from '../auth/AuthContext'
import { getHomeFeed } from '../api/music'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'
import { ImageCard, SongRow } from '../components/MusicCard'

const moods = ['Relax', 'Romance', 'Feel good', 'Party', 'Energise', 'Sad', 'Focus', 'Work out', 'Sleep']

function SectionTitle({ eyebrow, title }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!eyebrow && <Text style={{ marginBottom: 4, color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>{eyebrow}</Text>}
      <Text style={{ color: colors.text, fontFamily: typography.displayBold, fontSize: 24 }}>{title}</Text>
    </View>
  )
}

function Rail({ items, renderItem, emptyLabel }) {
  if (!items.length) return <Text style={{ color: colors.faint, fontFamily: typography.body, fontSize: 13 }}>{emptyLabel}</Text>
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 16 }}>
      {items.map((item, index) => renderItem(item, index))}
    </ScrollView>
  )
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth()
  const { listenHistory, playTrack, queue, isPlaying, currentTrack } = usePlayer()
  const [feed, setFeed] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadFeed = useCallback(async () => {
    setError('')
    try {
      setFeed(await getHomeFeed(listenHistory))
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your music right now.')
    }
  }, [listenHistory])

  useEffect(() => { loadFeed() }, [loadFeed])

  const refresh = async () => {
    setRefreshing(true)
    await loadFeed()
    setRefreshing(false)
  }

  const quickPicks = feed?.quickPicks || []
  const listenAgain = listenHistory.length ? listenHistory : (feed?.library || [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30, gap: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.amber} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../../assets/logo-source.png')} style={{ width: 32, height: 32 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontFamily: typography.displayBold, fontSize: 20 }}>Autumn</Text>
            <Text style={{ marginTop: 2, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>Good music, {user?.username || 'good company'}</Text>
          </View>
          <Pressable onPress={() => navigation.getParent()?.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Open profile" style={{ padding: 8 }}><UserRound color={colors.text} size={21} /></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {moods.map((mood) => (
              <Pressable key={mood} accessibilityRole="button" onPress={() => navigation.navigate('Mood', { mood })} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 8, backgroundColor: '#1f2325', paddingHorizontal: 13, paddingVertical: 8 }}>
              <Text style={{ color: colors.text, fontFamily: typography.bodyBold, fontSize: 12 }}>{mood}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 14, textAlign: 'center' }}>{error}</Text>
            <Pressable onPress={refresh} style={{ marginTop: 12, padding: 10 }}><Text style={{ color: colors.amber, fontFamily: typography.bodyBold }}>Try again</Text></Pressable>
          </View>
        ) : !feed ? (
          <View style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.amber} />
            <Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Finding your next listen</Text>
          </View>
        ) : (
          <>
            <View>
              <SectionTitle eyebrow="Made for the moment" title="Quick picks" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {quickPicks.slice(0, 24).map((song) => (
                  <Pressable key={song.id} onPress={() => playTrack(song, quickPicks)} accessibilityRole="button" accessibilityLabel={`Play ${song.title}`} style={{ width: 112 }}>
                    <View style={{ width: 112, aspectRatio: 1, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.elevated }}>
                      {song.image ? <Image source={{ uri: song.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                      {isPlaying && String(currentTrack?.id) === String(song.id) && <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.36)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontSize: 22 }}>♫</Text></View>}
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 7, color: colors.text, fontFamily: typography.bodyBold, fontSize: 12 }}>{song.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View>
              <SectionTitle eyebrow="Your listening space" title="Listen again" />
              <Rail items={listenAgain.slice(0, 18)} emptyLabel="Your recently played songs will show here." renderItem={(song) => (
                <ImageCard key={song.id} image={song.image} title={song.title} subtitle={song.artist} onPress={() => playTrack(song, listenAgain)} />
              )} />
            </View>

            <View>
              <SectionTitle eyebrow="Best for you" title="Your Library" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20 }}>
                {feed.library.slice(0, 24).reduce((columns, song, index) => {
                  const column = Math.floor(index / 4)
                  columns[column] ||= []
                  columns[column].push(song)
                  return columns
                }, []).map((column, columnIndex) => (
                  <View key={columnIndex} style={{ width: 290 }}>
                    {column.map((song) => (
                      <SongRow key={song.id} song={song} onPress={() => playTrack(song, feed.library)} trailing={<Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>} />
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>

            <View>
              <SectionTitle eyebrow="Your like playlists" title="Mix for you" />
              <Rail items={feed.playlists} emptyLabel="Your mixes are still warming up." renderItem={(item) => <ImageCard key={item.id} image={item.image} title={item.name} subtitle={item.description} onPress={() => navigation.navigate('Collection', { ...item, type: 'playlist' })} />} />
            </View>

            <View>
              <SectionTitle eyebrow="People to know" title="Popular artists" />
              <Rail items={feed.artists} emptyLabel="Artist picks are unavailable right now." renderItem={(item) => <ImageCard key={item.id} image={item.image} title={item.name} circular onPress={() => navigation.navigate('Collection', { ...item, type: 'artist' })} />} />
            </View>

            <View>
              <SectionTitle title="Albums for you" />
              <Rail items={feed.albums} emptyLabel="No albums to show right now." renderItem={(item) => <ImageCard key={item.id} image={item.image} title={item.name} subtitle={item.description} onPress={() => navigation.navigate('Collection', { ...item, type: 'album' })} />} />
            </View>

            <View>
              <SectionTitle eyebrow="New finds" title="Fresh discoveries" />
              <Rail items={feed.newReleases} emptyLabel="No new finds to show right now." renderItem={(song) => <ImageCard key={song.id} image={song.image} title={song.title} subtitle={song.artist} onPress={() => playTrack(song, feed.newReleases)} />} />
            </View>

            <View>
              <SectionTitle eyebrow="Feels like a foreigner" title="Hollywood Vibes" />
              <View style={{ gap: 2 }}>
                {feed.newReleases.slice(0, 6).map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, feed.newReleases)} compact />)}
              </View>
            </View>

            <View>
              <SectionTitle eyebrow="Trending shorts" title="Listen to Shorts" />
              <View style={{ gap: 2 }}>
                {feed.longSongs.slice(0, 8).map((song) => <SongRow key={song.id} song={song} onPress={() => playTrack(song, feed.longSongs)} />)}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}