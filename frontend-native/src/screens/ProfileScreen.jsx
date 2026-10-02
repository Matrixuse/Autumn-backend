import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { colors, typography } from '../theme/tokens'

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile, signOut } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setUsername(user?.username || '')
    setEmail(user?.email || '')
  }, [user])

  const save = async () => {
    setError('')
    try {
      await updateProfile({ username: username.trim(), email: email.trim() })
      setMessage('Profile updated')
    } catch (requestError) {
      setError(requestError.message || 'Could not update profile.')
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 100 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Account</Text>
      <Text style={{ marginTop: 5, marginBottom: 24, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Profile</Text>
      <View style={{ gap: 7, marginBottom: 16 }}><Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Username</Text><TextInput value={username} onChangeText={setUsername} maxLength={32} style={inputStyle} /></View>
      <View style={{ gap: 7, marginBottom: 20 }}><Text style={{ color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Email</Text><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={inputStyle} /></View>
      {!!message && <Text style={{ marginBottom: 14, color: colors.success, fontFamily: typography.body }}>{message}</Text>}
      {!!error && <Text style={{ marginBottom: 14, color: colors.danger, fontFamily: typography.body }}>{error}</Text>}
      <Pressable onPress={save} style={{ height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.amber }}><Text style={{ color: '#21160a', fontFamily: typography.bodyBold }}>Save changes</Text></Pressable>
      <Pressable onPress={() => navigation.navigate('Feedback')} style={{ height: 48, marginTop: 18, justifyContent: 'center' }}><Text style={{ color: colors.text, fontFamily: typography.bodyBold }}>Send feedback</Text></Pressable>
      <Pressable onPress={() => signOut()} style={{ height: 48, justifyContent: 'center' }}><Text style={{ color: colors.danger, fontFamily: typography.bodyBold }}>Log out</Text></Pressable>
    </ScrollView>
  )
}

const inputStyle = { height: 50, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: typography.body, fontSize: 15 }