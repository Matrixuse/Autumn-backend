import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { ArrowLeft, Clock3, Laptop, Radio, Smartphone } from 'lucide-react-native'
import { colors, typography } from '../theme/tokens'
import { createPlaybackHandoff, getConnectDeviceId, listConnectDevices, registerConnectDevice, revokeConnectDevice, updateConnectDevice } from '../api/connect'
import { usePlayer } from '../player/PlayerContext'

const seenLabel = (value) => {
  const age = Math.max(0, Date.now() - new Date(value).getTime())
  if (age < 60_000) return 'Just now'
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} hr ago`
  return new Date(value).toLocaleDateString()
}

export default function ContinueAnywhereScreen({ navigation }) {
  const player = usePlayer()
  const [deviceId, setDeviceId] = useState('')
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [renameTarget, setRenameTarget] = useState(null)
  const [name, setName] = useState('')
  const [transferId, setTransferId] = useState('')

  const refresh = useCallback(async (currentId = deviceId) => {
    setLoading(true)
    setError('')
    try {
      const registeredId = currentId || await getConnectDeviceId()
      setDeviceId(registeredId)
      await registerConnectDevice(registeredId)
      const response = await listConnectDevices(registeredId)
      setDevices(response.devices || [])
    } catch (requestError) {
      setError(requestError.message || 'Could not load your devices.')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => { void refresh() }, [refresh])

  const updateCurrent = async (updates, successMessage) => {
    setSaving(true)
    setError('')
    try {
      await updateConnectDevice(deviceId, updates)
      setMessage(successMessage)
      await refresh(deviceId)
    } catch (requestError) {
      setError(requestError.message || 'Could not save this setting.')
    } finally {
      setSaving(false)
    }
  }

  const saveName = async () => {
    const value = name.trim()
    if (!value || value.length > 48) { setError('Use a device name between 1 and 48 characters.'); return }
    setSaving(true)
    setError('')
    try {
      await updateConnectDevice(renameTarget.deviceId, { name: value })
      setRenameTarget(null)
      setMessage('Device name updated.')
      await refresh(deviceId)
    } catch (requestError) {
      setError(requestError.message || 'Could not rename this device.')
    } finally { setSaving(false) }
  }

  const removeDevice = (device) => Alert.alert('Remove device?', `Remove ${device.name} from your account?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setError('')
      try { await revokeConnectDevice(device.deviceId); setMessage(`${device.name} was removed.`); await refresh(deviceId) }
      catch (requestError) { setError(requestError.message || 'Could not remove this device.') }
    } }
  ])

  const movePlayback = async (device) => {
    setError('')
    setMessage('')
    try {
      const current = devices.find((item) => item.isCurrent)
      if (!current?.isPlaybackOwner || !player.currentTrack) throw new Error('Start playback on this device before moving it.')
      const snapshot = {
        sessionId: `${deviceId}-${Date.now()}`,
        revision: 0,
        track: player.currentTrack,
        positionMs: Math.round((player.progress || 0) * 1000),
        isPlaying: Boolean(player.isPlaying),
        queue: player.queue.slice(0, 100),
        currentIndex: player.currentIndex,
        shuffle: player.isShuffleEnabled,
        repeat: player.isRepeatEnabled,
        autoplay: true,
      }
      const { savePlaybackSnapshot } = await import('../api/connect')
      await savePlaybackSnapshot(deviceId, snapshot)
      const request = await createPlaybackHandoff(deviceId, device.deviceId)
      setTransferId(request._id)
      setMessage(`Waiting for ${device.name} to prepare playback...`)
    } catch (requestError) { setError(requestError.message || 'Could not start the transfer.') }
  }

  const current = devices.find((device) => device.isCurrent)
  const others = devices.filter((device) => !device.isCurrent)

  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 110 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back to Settings" hitSlop={10}><ArrowLeft color={colors.text} size={21} /></Pressable>
      <View style={{ flex: 1 }}><Text style={{ color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.3 }}>SETTINGS  /  DEVICES</Text><Text style={{ marginTop: 3, color: colors.text, fontFamily: typography.displayBold, fontSize: 25 }}>Continue Anywhere</Text></View>
    </View>

    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}><View style={iconStyle}><Radio color={colors.amber} size={20} /></View><View style={{ flex: 1 }}><Text style={titleStyle}>Continue Anywhere</Text><Text style={descriptionStyle}>Continue your music on another device without losing your current song, playback position or Up Next queue.</Text></View></View>
      {current && <SettingSwitch title="Enable Continue Anywhere on this device" description="When enabled, this device can participate in playback transfers and appear as an available device to your account." value={current.enabled} disabled={saving || loading} onChange={(value) => void updateCurrent({ enabled: value }, value ? 'Continue Anywhere is enabled.' : 'Continue Anywhere is disabled.')} />}
      {current && <SettingSwitch title="Allow this device to receive playback" description="This setting only controls whether this device can receive a transfer." value={current.allowReceiving} disabled={saving || loading} onChange={(value) => void updateCurrent({ allowReceiving: value }, value ? 'This device can receive playback.' : 'This device will not receive playback.')} />}
    </View>

    <View style={{ marginTop: 26 }}><SectionHeading title="This Device" onRefresh={() => void refresh(deviceId)} />
      {loading ? <ActivityIndicator color={colors.amber} style={{ padding: 18 }} /> : current ? <DeviceRow device={current} onRename={() => { setRenameTarget(current); setName(current.name) }} /> : <Text style={mutedStyle}>This device is not registered yet.</Text>}
    </View>

    <View style={{ marginTop: 26 }}><Text style={sectionTitleStyle}>Your Devices</Text>
      {loading ? <ActivityIndicator color={colors.amber} style={{ padding: 18 }} /> : error && !devices.length ? <Text style={{ ...mutedStyle, color: colors.danger }}>{error}</Text> : !others.length ? <View style={emptyStyle}><Text style={titleStyle}>No other devices connected yet.</Text><Text style={descriptionStyle}>Open Autumn on another device and sign in with the same account. It will appear here when registered.</Text></View> : others.map((device) => <DeviceRow key={device.deviceId} device={device} onRename={() => { setRenameTarget(device); setName(device.name) }} onRemove={() => removeDevice(device)} onMove={() => void movePlayback(device)} canMove={device.available && Boolean(current?.isPlaybackOwner) && Boolean(player.currentTrack) && !transferId} />)}
    </View>
    {!!(message || error) && <Text accessibilityRole="alert" style={{ marginTop: 16, color: error ? colors.danger : colors.success, fontFamily: typography.body, fontSize: 13 }}>{error || message}</Text>}
    {!!transferId && <Pressable onPress={() => setTransferId('')} style={{ marginTop: 8 }}><Text style={{ color: colors.amber, fontFamily: typography.bodyBold, fontSize: 12 }}>Dismiss transfer status</Text></Pressable>}

    <Modal visible={Boolean(renameTarget)} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
      <View style={modalBackdrop}><View style={modalStyle}><Text style={titleStyle}>Rename Device</Text><TextInput autoFocus value={name} onChangeText={setName} maxLength={48} accessibilityLabel="Device name" placeholder="Device name" placeholderTextColor={colors.faint} style={inputStyle} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}><Pressable onPress={() => setRenameTarget(null)} style={modalButton}><Text style={mutedStyle}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void saveName()} style={{ ...modalButton, backgroundColor: colors.amber }}><Text style={{ color: '#21160a', fontFamily: typography.bodyBold }}>Save</Text></Pressable></View>
      </View></View>
    </Modal>
  </ScrollView>
}

function SettingSwitch({ title, description, value, disabled, onChange }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
    <View style={{ flex: 1 }}><Text style={titleStyle}>{title}</Text><Text style={descriptionStyle}>{description}</Text></View>
    <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.elevated, true: colors.amber }} thumbColor={colors.text} accessibilityLabel={title} />
  </View>
}

function SectionHeading({ title, onRefresh }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}><Text style={sectionTitleStyle}>{title}</Text><Pressable onPress={onRefresh} accessibilityRole="button"><Text style={{ color: colors.amber, fontFamily: typography.bodyBold, fontSize: 12 }}>Refresh</Text></Pressable></View>
}

function DeviceRow({ device, onRename, onRemove, onMove, canMove }) {
  const Icon = device.platform === 'android' ? Smartphone : Laptop
  const state = device.status === 'online' ? 'Online' : device.status === 'recently-active' ? 'Recently active' : 'Offline'
  return <View style={deviceRowStyle}>
    <View style={iconStyle}><Icon color={colors.text} size={19} /></View><View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}><Text numberOfLines={1} style={titleStyle}>{device.name}</Text>{device.isCurrent && <Text style={badgeStyle}>THIS DEVICE</Text>}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 }}><Text style={mutedStyle}>{state}</Text><Clock3 color={colors.faint} size={12} /><Text style={mutedStyle}>{seenLabel(device.lastSeenAt)}</Text></View>
      <Text style={mutedStyle}>{device.isPlaybackOwner ? 'Playback owner' : device.available ? 'Available for playback' : 'Unavailable for playback'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}><Pressable onPress={onRename}><Text style={actionText}>Rename</Text></Pressable>{onRemove && <Pressable onPress={onRemove}><Text style={{ ...actionText, color: colors.danger }}>Remove</Text></Pressable>}{onMove && <Pressable disabled={!canMove} onPress={onMove}><Text style={{ ...actionText, opacity: canMove ? 1 : 0.35 }}>Move Playback</Text></Pressable>}</View>
    </View>
  </View>
}

const iconStyle = { width: 40, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated }
const titleStyle = { color: colors.text, fontFamily: typography.bodyBold, fontSize: 14 }
const descriptionStyle = { marginTop: 5, color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 }
const sectionTitleStyle = { color: colors.text, fontFamily: typography.displayBold, fontSize: 19 }
const mutedStyle = { marginTop: 4, color: colors.muted, fontFamily: typography.body, fontSize: 12 }
const actionText = { color: colors.amber, fontFamily: typography.bodyBold, fontSize: 12 }
const deviceRowStyle = { flexDirection: 'row', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border }
const emptyStyle = { paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }
const badgeStyle = { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(230,164,74,0.15)', color: colors.amber, fontFamily: typography.bodyBold, fontSize: 8 }
const modalBackdrop = { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.72)' }
const modalStyle = { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }
const inputStyle = { height: 48, marginTop: 16, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontFamily: typography.body }
const modalButton = { minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.elevated }