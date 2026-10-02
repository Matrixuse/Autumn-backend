import { GoogleSignin } from '@react-native-google-signin/google-signin'

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()
let configured = false

export const isGoogleSignInConfigured = Boolean(webClientId)

export const signInWithGoogleProvider = async () => {
  if (!webClientId) throw new Error('Google sign-in is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.')

  if (!configured) {
    GoogleSignin.configure({ webClientId, offlineAccess: false })
    configured = true
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const result = await GoogleSignin.signIn()
  if (result?.type === 'cancelled') return null

  const idToken = result?.data?.idToken || result?.idToken
  if (!idToken) throw new Error('Google did not return an ID token. Check the OAuth client configuration.')
  return idToken
}