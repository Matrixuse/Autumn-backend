import { Image } from 'expo-image'
import { Pause, Play, X } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { usePlayer } from '../player/PlayerContext'
import { colors, typography } from '../theme/tokens'

export default function MiniPlayer({ navigation }) {
  const { currentTrack, isPlaying, progress, duration, togglePlayback, stopPlayback } = usePlayer()
  if (!currentTrack) return null

  const percentage = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 68, overflow: 'hidden', borderRadius: 10, backgroundColor: '#1a1b1a', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ height: 2, backgroundColor: '#383735' }}><View style={{ width: `${percentage}%`, height: 2, backgroundColor: colors.amber }} /></View>
      <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 10 }}>
        <Pressable onPress={() => navigation.navigate('NowPlaying')} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {currentTrack.image ? <Image source={{ uri: currentTrack.image }} style={{ width: 40, height: 40, borderRadius: 5 }} contentFit="cover" /> : <View style={{ width: 40, height: 40, borderRadius: 5, backgroundColor: colors.elevated }} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.bodyBold, fontSize: 13 }}>{currentTrack.title}</Text>
            <Text numberOfLines={1} style={{ marginTop: 2, color: colors.muted, fontFamily: typography.body, fontSize: 11 }}>{currentTrack.artist}</Text>
          </View>
        </Pressable>
        <Pressable onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'} hitSlop={8} style={{ padding: 8 }}>
          {isPlaying ? <Pause color={colors.text} size={21} fill={colors.text} /> : <Play color={colors.text} size={21} fill={colors.text} />}
        </Pressable>
        <Pressable onPress={stopPlayback} accessibilityRole="button" accessibilityLabel="Stop playback" hitSlop={8} style={{ padding: 8 }}>
          <X color={colors.muted} size={19} />
        </Pressable>
      </View>
    </View>
  )
}