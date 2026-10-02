import 'react-native-gesture-handler'
import './global.css'
import { useEffect } from 'react'
import { DarkTheme, NavigationContainer } from '@react-navigation/native'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { AuthProvider } from './src/auth/AuthContext'
import { PlayerProvider } from './src/player/PlayerContext'
import RootNavigator from './src/navigation/RootNavigator'
import { colors } from './src/theme/tokens'

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.amber,
  },
}

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans: DMSans_400Regular,
    DMSansMedium: DMSans_500Medium,
    DMSansSemiBold: DMSans_600SemiBold,
    DMSansBold: DMSans_700Bold,
    SpaceGrotesk: SpaceGrotesk_500Medium,
    SpaceGroteskBold: SpaceGrotesk_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <AuthProvider>
            <NavigationContainer theme={navigationTheme}>
              <StatusBar style="light" backgroundColor={colors.background} />
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
