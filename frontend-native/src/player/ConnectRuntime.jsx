import { useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import {
  actOnPlaybackHandoff,
  getActivePlaybackHandoff,
  getConnectDeviceId,
  getPendingPlaybackHandoff,
  getPlaybackHandoff,
  heartbeatConnectDevice,
  registerConnectDevice,
  savePlaybackSnapshot,
} from '../api/connect'
import { getSongById } from '../api/music'
import { usePlayer } from './PlayerContext'

const cleanTrack = (track) => {
  if (!track?.id) return null
  return {
    id: String(track.id),
    ...(track.title ? { title: String(track.title).slice(0, 250) } : {}),
    ...(track.name ? { name: String(track.name).slice(0, 250) } : {}),
    ...(track.artist ? { artist: String(track.artist).slice(0, 250) } : {}),
    ...(track.subtitle ? { subtitle: String(track.subtitle).slice(0, 500) } : {}),
    ...(track.image ? { image: String(track.image).slice(0, 2048) } : {}),
    ...(track.album ? { album: String(track.album).slice(0, 250) } : {}),
    ...(track.duration != null ? { duration: track.duration } : {}),
    ...(track.language ? { language: String(track.language).slice(0, 64) } : {}),
  }
}

export default function ConnectRuntime() {
  const { user, isAuthenticated } = useAuth()
  const player = usePlayer()
  const deviceIdRef = useRef('')
  const playerRef = useRef(player)
  const registeredRef = useRef(null)
  const [registrationReady, setRegistrationReady] = useState(false)
  const sourceRequestRef = useRef(null)
  const targetRequestRef = useRef(null)
  const incomingPromptRef = useRef(new Set())
  const sourcePausedRef = useRef(new Set())
  const targetPreparedRef = useRef(new Set())
  const targetStartedRef = useRef(new Set())
  const sessionIdRef = useRef(`android-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const timerRef = useRef(null)
  const busyRef = useRef(false)

  playerRef.current = player

  const createSnapshot = (position = playerRef.current.progress) => {
    const activePlayer = playerRef.current
    const track = cleanTrack(activePlayer.currentTrack)
    let queue = (activePlayer.queue || []).map(cleanTrack).filter(Boolean)
    let currentIndex = activePlayer.currentIndex
    if (track && !queue.some((item) => item.id === track.id)) {
      queue = [track, ...queue]
      currentIndex = 0
    }
    return {
      sessionId: sessionIdRef.current,
      revision: 0,
      track,
      positionMs: Math.max(0, Math.round(Number(position || 0) * 1000)),
      isPlaying: Boolean(activePlayer.isPlaying),
      queue: queue.slice(0, 100),
      currentIndex: Math.max(-1, Math.min(Number(currentIndex), 99)),
      shuffle: Boolean(activePlayer.isShuffleEnabled),
      repeat: Boolean(activePlayer.isRepeatEnabled),
      autoplay: true,
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      registeredRef.current = null
      deviceIdRef.current = ''
      setRegistrationReady(false)
      return undefined
    }
    let mounted = true
    let heartbeatTimer
    getConnectDeviceId().then(async (deviceId) => {
      if (!mounted) return
      deviceIdRef.current = deviceId
      try { registeredRef.current = await registerConnectDevice(deviceId) } catch { }
      if (mounted) setRegistrationReady(Boolean(registeredRef.current))
      const heartbeat = async () => {
        if (AppState.currentState !== 'active') return
        try { await heartbeatConnectDevice(deviceId) } catch { }
      }
      heartbeatTimer = setInterval(() => { void heartbeat() }, 30_000)
      void heartbeat()
    }).catch(() => {})
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && deviceIdRef.current) void heartbeatConnectDevice(deviceIdRef.current).catch(() => {})
    })
    return () => {
      mounted = false
      clearInterval(heartbeatTimer)
      subscription.remove()
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !registrationReady || !registeredRef.current?.enabled || !player.currentTrack || !deviceIdRef.current) return undefined
    let active = true
    const sync = () => {
      if (!active || sourceRequestRef.current) return
      const snapshot = createSnapshot()
      if (snapshot.track) savePlaybackSnapshot(deviceIdRef.current, snapshot).catch(() => {})
    }
    sync()
    const interval = setInterval(sync, 8000)
    return () => { active = false; clearInterval(interval) }
  }, [isAuthenticated, registrationReady, player.currentTrack, player.queue, player.currentIndex, player.isPlaying, player.progress, player.isShuffleEnabled, player.isRepeatEnabled])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let mounted = true
    const poll = async () => {
      const deviceId = deviceIdRef.current
      if (!mounted || !deviceId || !registeredRef.current?.enabled || AppState.currentState !== 'active' || busyRef.current) {
        if (mounted) timerRef.current = setTimeout(poll, 5000)
        return
      }
      busyRef.current = true
      let delay = 5000
      try {
        if (!sourceRequestRef.current) {
          sourceRequestRef.current = await getActivePlaybackHandoff(deviceId)
        }
        if (!targetRequestRef.current) {
          const pending = await getPendingPlaybackHandoff(deviceId)
          if (pending && !incomingPromptRef.current.has(pending._id)) {
            const result = await (await import('../api/connect')).listConnectDevices(deviceId)
            const sourceName = result.devices?.find((item) => item.deviceId === pending.sourceDeviceId)?.name || 'another device'
            targetRequestRef.current = pending
            incomingPromptRef.current.add(pending._id)
            Alert.alert(
              'Continue playback here?',
              `${sourceName} wants to continue ${pending.snapshot?.track?.title || pending.snapshot?.track?.name || 'the current track'}${pending.snapshot?.track?.artist ? ` by ${pending.snapshot.track.artist}` : ''}.`,
              [
                { text: 'Decline', style: 'cancel', onPress: () => { void actOnPlaybackHandoff(pending._id, deviceId, 'decline').then(() => { targetRequestRef.current = null }).catch(() => {}) } },
                { text: 'Play Here', onPress: () => { void acceptIncoming(pending, deviceId) } },
              ],
              { cancelable: false }
            )
          }
        }

        const sourceRequest = sourceRequestRef.current
        if (sourceRequest?._id) {
          delay = 1800
          const status = await getPlaybackHandoff(sourceRequest._id, deviceId)
          sourceRequestRef.current = ['STARTED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status.state) ? null : status
          if (status.state === 'TARGET_READY') {
            sourcePausedRef.current.add(status._id)
            const activePlayer = playerRef.current
            const position = activePlayer.pauseForHandoff()
            try {
              await actOnPlaybackHandoff(status._id, deviceId, 'source-paused', createSnapshot(position))
            } catch {
            }
          } else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status.state)) {
            if (status.ownerRestored && sourcePausedRef.current.has(status._id)) playerRef.current.setPlaybackPaused(false)
            sourcePausedRef.current.delete(status._id)
          }
        }

        const targetRequest = targetRequestRef.current
        if (targetRequest?._id) {
          delay = 1800
          const status = await getPlaybackHandoff(targetRequest._id, deviceId)
          targetRequestRef.current = ['STARTED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(status.state) ? null : status
          if (status.state === 'COMMITTED' && targetPreparedRef.current.has(status._id) && !targetStartedRef.current.has(status._id)) {
            targetStartedRef.current.add(status._id)
            const started = await playerRef.current.startPreparedPlayback()
            if (started) await actOnPlaybackHandoff(status._id, deviceId, 'started')
            else {
              targetStartedRef.current.delete(status._id)
              const result = await actOnPlaybackHandoff(status._id, deviceId, 'failed').catch(() => null)
              if (result?.ownerRestored) targetRequestRef.current = null
            }
          }
        }
      } catch { }
      finally {
        busyRef.current = false
        if (mounted) timerRef.current = setTimeout(poll, delay)
      }
    }
    const acceptIncoming = async (request, deviceId) => {
      try {
        await actOnPlaybackHandoff(request._id, deviceId, 'accept')
        const resolved = await getSongById(request.snapshot.track.id)
        if (!resolved?.audio) throw new Error('This track is not available on this device.')
        const track = { ...request.snapshot.track, ...resolved }
        let queue = (request.snapshot.queue || []).map((item) => String(item.id) === String(track.id) ? track : item)
        let index = queue.findIndex((item) => String(item.id) === String(track.id))
        if (index < 0) { queue = [track, ...queue]; index = 0 }
        const ready = await playerRef.current.prepareTransferredPlayback({ ...request.snapshot, currentIndex: index }, queue)
        if (!ready) throw new Error('Autumn could not prepare this track.')
        targetPreparedRef.current.add(request._id)
        await actOnPlaybackHandoff(request._id, deviceId, 'ready')
      } catch {
        await actOnPlaybackHandoff(request._id, deviceId, 'failed').catch(() => {})
        targetRequestRef.current = null
        incomingPromptRef.current.delete(request._id)
        Alert.alert('Could not prepare playback', 'The source device will keep playing. Try again after checking your connection.')
      }
    }
    void poll()
    return () => { mounted = false; clearTimeout(timerRef.current) }
  }, [isAuthenticated])

  return null
}