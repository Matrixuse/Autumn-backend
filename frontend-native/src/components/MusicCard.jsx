import { Image } from 'expo-image'
import { Play } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import SongActionsSheet from './SongActionsSheet'
import { colors, typography } from '../theme/tokens'

export function ImageCard({ image, title, subtitle, onPress, circular = false, width = 148 }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ width }}>
      <View style={{ width, aspectRatio: 1, borderRadius: circular ? width / 2 : 10, overflow: 'hidden', backgroundColor: colors.elevated }}>
        {image ? <Image source={{ uri: image }} contentFit="cover" transition={160} style={{ width: '100%', height: '100%' }} /> : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
            <Play color={colors.amber} size={28} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 9, color: colors.text, fontFamily: typography.bodyBold, fontSize: 14 }}>{title}</Text>
      {!!subtitle && <Text numberOfLines={1} style={{ marginTop: 3, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{subtitle}</Text>}
    </Pressable>
  )
}

export function SongRow({ song, onPress, trailing, compact = false }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play ${song.title}`} style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ width: 50, height: 50, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.elevated }}>
        {song.image ? <Image source={{ uri: song.image }} contentFit="cover" transition={160} style={{ width: '100%', height: '100%' }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontFamily: typography.bodyBold, fontSize: 14 }}>{song.title}</Text>
        {!compact && <Text numberOfLines={1} style={{ marginTop: 4, color: colors.muted, fontFamily: typography.body, fontSize: 12 }}>{song.artist}</Text>}
      </View>
      {trailing || <SongActionsSheet song={song} />}
    </Pressable>
  )
}