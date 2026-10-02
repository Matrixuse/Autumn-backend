import { ActivityIndicator, Text, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Home, Library, ListMusic, Search, FastForward } from 'lucide-react-native'
import AuthScreen from '../screens/AuthScreen'
import HomeScreen from '../screens/HomeScreen'
import ForYouScreen from '../screens/ForYouScreen'
import SearchScreen from '../screens/SearchScreen'
import PlaylistsScreen from '../screens/PlaylistsScreen'
import LibraryScreen from '../screens/LibraryScreen'
import MoodScreen from '../screens/MoodScreen'
import CollectionScreen from '../screens/CollectionScreen'
import NowPlayingScreen from '../screens/NowPlayingScreen'
import SongListScreen from '../screens/SongListScreen'
import NewPlaylistScreen from '../screens/NewPlaylistScreen'
import LocalPlaylistScreen from '../screens/LocalPlaylistScreen'
import ProfileScreen from '../screens/ProfileScreen'
import FeedbackScreen from '../screens/FeedbackScreen'
import MiniPlayer from '../components/MiniPlayer'
import { useAuth } from '../auth/AuthContext'
import { colors, typography } from '../theme/tokens'

const Stack = createNativeStackNavigator()
const Tabs = createBottomTabNavigator()

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Login">
        {(props) => <AuthScreen {...props} mode="login" />}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {(props) => <AuthScreen {...props} mode="register" />}
      </Stack.Screen>
    </Stack.Navigator>
  )
}

function MainTabs() {
  const tabs = [
    { name: 'Home', icon: Home, component: HomeScreen },
    { name: 'For you', icon: FastForward, component: ForYouScreen },
    { name: 'Search', icon: Search, component: SearchScreen },
    { name: 'Playlists', icon: ListMusic, component: PlaylistsScreen },
    { name: 'Library', icon: Library, component: LibraryScreen },
  ]

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const Icon = tabs.find((tab) => tab.name === route.name)?.icon || Home
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: '#777570',
          tabBarStyle: { height: 64, paddingTop: 8, paddingBottom: 8, backgroundColor: '#090a0a', borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 10, fontFamily: typography.bodyBold },
          tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
        }
      }}
    >
      {tabs.map(({ name, component }) => <Tabs.Screen key={name} name={name} component={component} />)}
    </Tabs.Navigator>
  )
}

function MainShell({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MainTabs />
      <MiniPlayer navigation={navigation} />
    </View>
  )
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-autumn-background">
        <ActivityIndicator color={colors.amber} size="large" />
        <Text className="mt-4 font-body text-sm text-autumn-muted">Checking your Autumn session</Text>
      </View>
    )
  }

  if (!isAuthenticated) return <AuthStack />

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="MainTabs" component={MainShell} />
      <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Mood" component={MoodScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="LikedSongs">
        {(props) => <SongListScreen {...props} route={{ ...props.route, params: { title: 'Liked music', kind: 'liked' } }} />}
      </Stack.Screen>
      <Stack.Screen name="RecentlyPlayed">
        {(props) => <SongListScreen {...props} route={{ ...props.route, params: { title: 'Recently played', kind: 'recent' } }} />}
      </Stack.Screen>
      <Stack.Screen name="NewPlaylist" component={NewPlaylistScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LocalPlaylist" component={LocalPlaylistScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
    </Stack.Navigator>
  )
}