import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronRight, Radio, SlidersHorizontal } from 'lucide-react-native'
import { colors, typography } from '../theme/tokens'

export default function SettingsScreen({ navigation }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 100 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Account</Text>
      <Text style={{ marginTop: 5, marginBottom: 24, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Settings</Text>
      <Pressable onPress={() => navigation.navigate('ContinueAnywhere')} accessibilityRole="button" accessibilityLabel="Continue Anywhere settings" style={rowStyle}>
        <View style={iconStyle}><Radio color={colors.amber} size={20} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={titleStyle}>Continue Anywhere</Text><Text style={descriptionStyle}>Move your music between your devices and continue listening from where you left off.</Text></View>
        <ChevronRight color={colors.faint} size={20} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Equalizer')} accessibilityRole="button" accessibilityLabel="Equalizer" style={rowStyle}>
        <View style={iconStyle}><SlidersHorizontal color={colors.amber} size={20} /></View>
        <View style={{ flex: 1 }}><Text style={titleStyle}>Equalizer</Text><Text style={descriptionStyle}>Tune the sound to suit your listening.</Text></View>
        <ChevronRight color={colors.faint} size={20} />
      </Pressable>
    </ScrollView>
  )
}

const rowStyle = { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.border }
const iconStyle = { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(230,164,74,0.12)' }
const titleStyle = { color: colors.text, fontFamily: typography.bodyBold, fontSize: 15 }
const descriptionStyle = { marginTop: 4, color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 }