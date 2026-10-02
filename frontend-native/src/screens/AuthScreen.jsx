import { useState } from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight, Eye, EyeOff, Music2 } from 'lucide-react-native'
import { useAuth } from '../auth/AuthContext'
import { colors } from '../theme/tokens'

export default function AuthScreen({ mode, navigation }) {
  const isLogin = mode === 'login'
  const { signIn, signUp } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSubmitting(true)
    try {
      if (isLogin) await signIn({ email: email.trim(), password })
      else await signUp({ username: username.trim(), email: email.trim(), password })
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* Google sign-in stays disabled until its native module is configured in the Expo binary.
  const googleLogin = async () => {
    setError('')
    setSubmitting(true)
    try {
      const idToken = await signInWithGoogleProvider()
      if (idToken) await signInWithGoogle(idToken)
    } catch (requestError) {
      setError(requestError.message || 'Google sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  */

  const inputClass = 'mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 font-body text-base text-autumn-text'

  return (
    <LinearGradient style={{ flex: 1 }} colors={['#101413', '#080909', '#050505']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 pb-10 pt-14">
            <View className="mb-10 flex-row items-center gap-3">
              <Image source={require('../../assets/logo-source.png')} className="h-12 w-12" resizeMode="contain" />
              <View>
                <Text className="font-display text-2xl text-autumn-text">Autumn</Text>
                <Text className="font-body text-xs text-autumn-muted">Your music, your season</Text>
              </View>
            </View>

            <Text className="mb-2 font-body text-xs font-bold uppercase tracking-[2px] text-autumn-eyebrow">
              {isLogin ? 'Welcome back' : 'Create your space'}
            </Text>
            <Text className="font-display text-3xl leading-10 text-autumn-text">
              {isLogin ? 'Pick up where you left off.' : 'Make room for your sound.'}
            </Text>
            <Text className="mt-3 font-body text-sm leading-6 text-autumn-muted">
              {isLogin ? 'Your playlists and favorite moments are waiting.' : 'Start a personal listening space built around you.'}
            </Text>

            {!isLogin && (
              <View className="mt-8">
                <Text className="font-body text-sm font-semibold text-white/75">Username</Text>
                <TextInput
                  accessibilityLabel="Username"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={username}
                  onChangeText={setUsername}
                  maxLength={32}
                  placeholder="Choose a username"
                  placeholderTextColor="#777570"
                  className={inputClass}
                />
              </View>
            )}

            <View className={isLogin ? 'mt-8' : 'mt-5'}>
              <Text className="font-body text-sm font-semibold text-white/75">Email</Text>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#777570"
                className={inputClass}
              />
            </View>

            <View className="mt-5">
              <Text className="font-body text-sm font-semibold text-white/75">Password</Text>
              <View className="mt-2 flex-row items-center rounded-xl border border-white/10 bg-white/5 pr-3">
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                  maxLength={128}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#777570"
                  className="min-h-12 flex-1 px-4 py-3.5 font-body text-base text-autumn-text"
                />
                <Pressable onPress={() => setPasswordVisible((visible) => !visible)} accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} className="p-2">
                  {passwordVisible ? <EyeOff color={colors.muted} size={19} /> : <Eye color={colors.muted} size={19} />}
                </Pressable>
              </View>
            </View>

            {!!error && (
              <Text accessibilityRole="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2.5 font-body text-sm text-red-200">
                {error}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={submitting || !email.trim() || password.length < 8 || (!isLogin && username.trim().length < 3)}
              onPress={submit}
              className="mt-6 min-h-14 flex-row items-center justify-center gap-2 rounded-xl bg-autumn-amber px-4 py-3.5 active:bg-autumn-amberBright disabled:opacity-50"
            >
              {submitting ? <ActivityIndicator color="#21160a" /> : <>
                <Text className="font-body text-sm font-bold text-[#21160a]">{isLogin ? 'Log in' : 'Create account'}</Text>
                <ArrowRight color="#21160a" size={17} />
              </>}
            </Pressable>

            {/* Google sign-in is temporarily disabled.
            {isLogin && isGoogleSignInConfigured && (
              <>
                <View className="my-6 flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-white/10" />
                  <Text className="font-body text-[10px] uppercase tracking-widest text-white/35">or continue with</Text>
                  <View className="h-px flex-1 bg-white/10" />
                </View>
                <Pressable disabled={submitting} onPress={googleLogin} className="min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 active:bg-white/10">
                  <Text className="font-body text-sm font-semibold text-autumn-text">Continue with Google</Text>
                </Pressable>
              </>
            )}
            */}

            <Pressable
              accessibilityRole="button"
              onPress={() => { setError(''); navigation.navigate(isLogin ? 'Register' : 'Login') }}
              className="mt-7 min-h-12 flex-row items-center justify-center gap-1"
            >
              <Text className="font-body text-sm text-autumn-muted">{isLogin ? "Don't have an account?" : 'Already have an account?'}</Text>
              <Text className="font-body text-sm font-bold text-autumn-amber">{isLogin ? 'Sign up' : 'Log in'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}