import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { colors, typography } from '../theme/tokens'

const STORAGE_KEY = 'musious_feedbacks_v1'

export default function FeedbackScreen() {
  const { user } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState([])
  const [notice, setNotice] = useState('')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value) setItems(JSON.parse(value)) }).catch(() => {})
  }, [])

  const submit = async () => {
    if (!message.trim()) { setNotice('Write a note before submitting.'); return }
    const next = [{ id: Date.now(), username: username.trim() || 'Anonymous', message: message.trim(), createdAt: new Date().toISOString() }, ...items]
    setItems(next)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
    setMessage('')
    setNotice('Feedback added')
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 100 }}>
      <Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>Your voice</Text>
      <Text style={{ marginTop: 5, marginBottom: 7, color: colors.text, fontFamily: typography.displayBold, fontSize: 28 }}>Feedback</Text>
      <Text style={{ marginBottom: 18, color: colors.muted, fontFamily: typography.body, fontSize: 13 }}>Share a note with the Autumn team.</Text>
      <TextInput value={username} onChangeText={setUsername} placeholder="Your name (optional)" placeholderTextColor={colors.faint} style={inputStyle} />
      <TextInput value={message} onChangeText={setMessage} multiline textAlignVertical="top" placeholder="Your feedback" placeholderTextColor={colors.faint} style={[inputStyle, { minHeight: 115, marginTop: 10, paddingTop: 12 }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}><Pressable onPress={submit} style={{ paddingHorizontal: 18, paddingVertical: 11, borderRadius: 9, backgroundColor: colors.amber }}><Text style={{ color: '#21160a', fontFamily: typography.bodyBold }}>Submit</Text></Pressable><Pressable onPress={() => { setUsername(''); setMessage(''); setNotice('') }}><Text style={{ color: colors.muted, fontFamily: typography.body }}>Clear</Text></Pressable><Text style={{ color: colors.success, fontFamily: typography.body, fontSize: 12 }}>{notice}</Text></View>
      <Text style={{ marginTop: 28, marginBottom: 12, color: colors.text, fontFamily: typography.displayBold, fontSize: 20 }}>Recent feedback</Text>
      {!items.length ? <Text style={{ color: colors.muted, fontFamily: typography.body }}>No feedback yet.</Text> : items.map((item) => <View key={item.id} style={{ marginBottom: 10, padding: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontFamily: typography.bodyBold }}>{item.username}</Text><Text style={{ color: colors.faint, fontFamily: typography.body, fontSize: 10 }}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={{ marginTop: 8, color: colors.text, fontFamily: typography.body, fontSize: 14 }}>{item.message}</Text></View>)}
    </ScrollView>
  )
}

const inputStyle = { minHeight: 48, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: typography.body, fontSize: 14 }