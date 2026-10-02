import { Image, Pressable, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'

export default function FoundationScreen({ title }) {
  const { user, signOut, startupError } = useAuth()

  return (
    <View className="flex-1 bg-autumn-background px-3 pt-3">
      <View className="flex-row items-center gap-3">
        <Image source={require('../../assets/logo-source.png')} className="h-12 w-12" resizeMode="contain" />
        <View>
          <Text className="font-display text-2xl text-autumn-text">Autumn</Text>
          <Text className="font-body text-xs text-autumn-muted">{title}</Text>
        </View>
      </View>
      <View className="mt-12 rounded-2xl border border-autumn-border bg-autumn-surface p-5">
        <Text className="font-display text-xl text-autumn-text">Your listening space</Text>
        <Text className="mt-2 font-body text-sm leading-6 text-autumn-muted">
          {user?.username ? `Signed in as ${user.username}.` : 'Your account is ready.'} Music browsing arrives in the next phase.
        </Text>
        {!!startupError && <Text className="mt-3 font-body text-xs text-autumn-eyebrow">{startupError}</Text>}
        <Pressable
          accessibilityRole="button"
          onPress={() => signOut().catch(() => {})}
          className="mt-6 items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 active:bg-white/10"
        >
          <Text className="font-body text-sm font-semibold text-autumn-text">Log out</Text>
        </Pressable>
      </View>
    </View>
  )
}