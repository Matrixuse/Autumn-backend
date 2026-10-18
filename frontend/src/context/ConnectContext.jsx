import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { getBestAudioUrl } from '../utils/mediaQuality'
import { getSongById } from '../api/songs'
import {
  actOnPlaybackHandoff,
  createPlaybackHandoff,
  getConnectDeviceId,
  getActivePlaybackHandoff,
  getPendingPlaybackHandoff,
  getPlaybackHandoff,
  heartbeatConnectDevice,
  listConnectDevices,
  registerConnectDevice,
  savePlaybackSnapshot
} from '../api/connect'
import { useAuth } from './AuthContext'
import { usePlayer } from './PlayerContext'

const ConnectContext = createContext(null)

const safeTrack = (track) => {
  if (!track?.id) return null
  return {
    id: String(track.id),
    ...(track.title ? { title: String(track.title).slice(0, 250) } : {}),
    ...(track.name ? { name: String(track.name).slice(0, 250) } : {}),
    ...(track.artist ? { artist: String(track.artist).slice(0, 250) } : {}),
    ...(track.subtitle ? { subtitle: String(track.subtitle).slice(0, 500) } : {}),
    ...(typeof track.image === 'string' ? { image: track.image.slice(0, 2048) } : {}),
    ...(track.album ? { album: String(track.album).slice(0, 250) } : {}),
    ...(track.duration != null ? { duration: track.duration } : {}),
    ...(track.language ? { language: String(track.language).slice(0, 64) } : {}),
    ...(track.queueSource ? { queueSource: String(track.queueSource).slice(0, 32) } : {})
  }
}

const createSessionId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function ConnectProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const player = usePlayer()
  const deviceId = useRef(getConnectDeviceId()).current
  const playerRef = useRef(player)
  const snapshotRef = useRef(null)
  const sessionIdRef = useRef(createSessionId())
  const pollTimerRef = useRef(null)
  const pollingRef = useRef(false)
  const initiatingTransferRef = useRef(false)
  const sourcePausedRef = useRef(new Set())
  const targetPreparedRef = useRef(new Set())
  const targetStartedRef = useRef(new Set())
  const targetNeedsGestureRef = useRef(new Set())
  const dismissedRef = useRef(new Set())
  const incomingRef = useRef(null)
  const transferRef = useRef(null)
  const [registeredDevice, setRegisteredDevice] = useState(null)
  const [registrationError, setRegistrationError] = useState(null)
  const registrationReadyRef = useRef(false)
  const [incoming, setIncoming] = useState(null)
  const [incomingBusy, setIncomingBusy] = useState(false)
  const [incomingError, setIncomingError] = useState('')
  const [transfer, setTransfer] = useState(null)

  playerRef.current = player
  incomingRef.current = incoming
  transferRef.current = transfer

  snapshotRef.current = (position = player.progress) => {
    const activePlayer = playerRef.current
    const activeTrack = safeTrack(activePlayer.currentTrack)
    let tracks = (activePlayer.queue || []).map(safeTrack).filter(Boolean)
    let currentIndex = Number.isInteger(activePlayer.currentIndex) ? activePlayer.currentIndex : -1
    if (activeTrack && !tracks.some((track) => track.id === activeTrack.id)) {
      tracks = [activeTrack, ...tracks]
      currentIndex = 0
    }
    return {
      sessionId: sessionIdRef.current,
      revision: 0,
      track: activeTrack,
      positionMs: Math.max(0, Math.round(Number(position || 0) * 1000)),
      isPlaying: Boolean(activePlayer.isPlaying),
      queue: tracks.slice(0, 100),
      currentIndex: Math.max(-1, Math.min(currentIndex, 99)),
      shuffle: Boolean(activePlayer.isShuffleEnabled),
      repeat: Boolean(activePlayer.isRepeatEnabled),
      autoplay: Boolean(activePlayer.isAutoplayEnabled)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      registrationReadyRef.current = false
      setRegisteredDevice(null)
      setRegistrationError(null)
      return undefined
    }
    let active = true
    const beat = async () => {
      if (!registrationReadyRef.current || document.visibilityState !== 'visible') return
      try { await heartbeatConnectDevice(deviceId) } catch { }
    }
    registerConnectDevice(deviceId).then((device) => {
      if (active) {
        registrationReadyRef.current = true
        setRegisteredDevice(device)
        setRegistrationError(null)
      }
    }).catch((error) => { if (active) setRegistrationError(error) })
    const heartbeatTimer = window.setInterval(() => { void beat() }, 30_000)
    const handleVisibility = () => { if (document.visibilityState === 'visible') void beat() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      window.clearInterval(heartbeatTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [deviceId, isAuthenticated, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !registeredDevice?.enabled || !player.currentTrack) return undefined
    let active = true
    const sync = () => {
      if (transferRef.current && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(transferRef.current.state)) return
      const snapshot = snapshotRef.current?.()
      if (snapshot?.track && active) savePlaybackSnapshot(deviceId, snapshot).catch(() => {})
    }
    sync()
    const timer = window.setInterval(sync, 8000)
    return () => { active = false; window.clearInterval(timer) }
  }, [deviceId, isAuthenticated, player.currentTrack, player.queue, player.currentIndex, player.isPlaying, player.isShuffleEnabled, player.isRepeatEnabled, registeredDevice?.enabled])

  useEffect(() => {
    if (!isAuthenticated || !registeredDevice?.enabled) return undefined
    let mounted = true
    const poll = async () => {
      if (!mounted || document.visibilityState !== 'visible' || pollingRef.current) return
      pollingRef.current = true
      let nextDelay = 5000
      try {
        const activeTransfer = transferRef.current
        const activeIncoming = incomingRef.current
        if (!activeTransfer) {
          const activeRequest = await getActivePlaybackHandoff(deviceId)
          if (activeRequest && mounted) setTransfer((value) => value || { ...activeRequest, uiState: 'Reconnecting to playback transfer...' })
        }
        if (!activeIncoming || ['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(activeIncoming.state)) {
          const pending = await getPendingPlaybackHandoff(deviceId)
          if (pending && !dismissedRef.current.has(pending._id) && incomingRef.current?._id !== pending._id) {
            let sourceDeviceName = 'Another device'
            try {
              const result = await listConnectDevices(deviceId)
              sourceDeviceName = result.devices?.find((device) => device.deviceId === pending.sourceDeviceId)?.name || sourceDeviceName
            } catch { }
            if (mounted) setIncoming({ ...pending, sourceDeviceName })
          }
        }

        const currentIncoming = incomingRef.current
        const trackedTransfer = activeTransfer && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(activeTransfer.state) ? activeTransfer : null
        const trackedIncoming = currentIncoming && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(currentIncoming.state) ? currentIncoming : null
        const tracked = trackedTransfer || trackedIncoming
        if (tracked?._id) {
          nextDelay = 1800
          const status = await getPlaybackHandoff(tracked._id, deviceId)
          if (status && mounted) {
            if (tracked.sourceDeviceId === deviceId) {
              setTransfer((value) => value?._id === status._id ? { ...value, ...status } : value)
              if (status.state === 'TARGET_READY') {
                sourcePausedRef.current.add(status._id)
                setTransfer((value) => value?._id === status._id ? { ...value, uiState: 'Moving playback...' } : value)
                const activePlayer = playerRef.current
                const position = activePlayer.pauseForHandoff?.() ?? activePlayer.progress
                const finalSnapshot = snapshotRef.current?.(position)
                try {
                  const committed = await actOnPlaybackHandoff(status._id, deviceId, 'source-paused', finalSnapshot)
                  setTransfer((value) => value?._id === status._id ? { ...value, ...committed, uiState: 'Waiting for playback to start on the other device...' } : value)
                } catch {
                  setTransfer((value) => value?._id === status._id ? { ...value, state: 'TARGET_READY', uiState: 'Confirming the transfer with the other device...' } : value)
                }
              } else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status.state)) {
                if (status.ownerRestored && sourcePausedRef.current.has(status._id)) playerRef.current.setPlaybackPaused?.(false)
                sourcePausedRef.current.delete(status._id)
                setTransfer((value) => value?._id === status._id ? { ...value, ...status, uiState: status.state === 'CANCELLED' ? 'Transfer cancelled; playback continues here.' : 'Transfer failed; playback continues here.' } : value)
              } else if (status.state === 'PENDING') setTransfer((value) => value?._id === status._id ? { ...value, uiState: `Waiting for ${value.targetName || 'the other device'}...` } : value)
              else if (status.state === 'ACCEPTED') setTransfer((value) => value?._id === status._id ? { ...value, uiState: 'Preparing song on the other device...' } : value)
              else if (status.state === 'STARTED') {
                sourcePausedRef.current.delete(status._id)
                setTransfer((value) => value?._id === status._id ? { ...value, uiState: `Playback moved successfully to ${value.targetName || 'the other device'}.` } : value)
              }
            } else if (tracked.targetDeviceId === deviceId) {
              setIncoming((value) => value?._id === status._id ? { ...value, ...status, ...(targetNeedsGestureRef.current.has(status._id) ? { state: 'READY_TO_START' } : {}) } : value)
              if (status.state === 'COMMITTED' && targetPreparedRef.current.has(status._id) && !targetStartedRef.current.has(status._id) && !targetNeedsGestureRef.current.has(status._id)) {
                targetStartedRef.current.add(status._id)
                const started = await playerRef.current.startPreparedPlayback?.()
                if (started) {
                  await actOnPlaybackHandoff(status._id, deviceId, 'started')
                  setIncoming((value) => value?._id === status._id ? { ...value, state: 'STARTED' } : value)
                } else {
                  targetStartedRef.current.delete(status._id)
                  targetNeedsGestureRef.current.add(status._id)
                  setIncoming((value) => value?._id === status._id ? { ...value, state: 'READY_TO_START', error: 'Playback is ready. Tap Play Here to begin.' } : value)
                }
              }
            }
          }
        }
      } catch { }
      finally {
        pollingRef.current = false
        if (mounted) pollTimerRef.current = window.setTimeout(poll, nextDelay)
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(pollTimerRef.current)
        void poll()
      } else window.clearTimeout(pollTimerRef.current)
    }
    void poll()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      mounted = false
      window.clearTimeout(pollTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [deviceId, isAuthenticated, registeredDevice?.enabled])

  const movePlayback = async (targetDevice) => {
    if (!playerRef.current.currentTrack) throw new Error('Start a song before moving playback.')
    if (transferRef.current && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(transferRef.current.state)) throw new Error('A playback transfer is already in progress.')
    if (initiatingTransferRef.current) throw new Error('A playback transfer is already being requested.')
    initiatingTransferRef.current = true
    try {
      const snapshot = snapshotRef.current?.()
      if (!snapshot?.track) throw new Error('There is no active playback session to move.')
      await savePlaybackSnapshot(deviceId, snapshot)
      const request = await createPlaybackHandoff(deviceId, targetDevice.deviceId)
      const nextTransfer = { ...request, targetName: targetDevice.name, uiState: 'Waiting for the other device...' }
      setTransfer(nextTransfer)
      return nextTransfer
    } finally {
      initiatingTransferRef.current = false
    }
  }
  const acceptIncoming = async () => {
    const request = incomingRef.current
    if (!request || incomingBusy) return
    setIncomingBusy(true)
    setIncomingError('')
    try {
      await actOnPlaybackHandoff(request._id, deviceId, 'accept')
      setIncoming((value) => value?._id === request._id ? { ...value, state: 'PREPARING' } : value)
      const resolved = await getSongById(request.snapshot.track.id)
      const audio = getBestAudioUrl(resolved?.downloadUrl) || getBestAudioUrl(resolved?.audio) || resolved?.audio
      if (!resolved || !audio) throw new Error('This song is not available to play on this device.')
      const currentTrack = { ...request.snapshot.track, ...resolved, audio }
      const queue = (request.snapshot.queue || []).map((track) => String(track.id) === String(currentTrack.id) ? currentTrack : track)
      const index = Math.max(0, queue.findIndex((track) => String(track.id) === String(currentTrack.id)))
      if (!queue.length) queue.push(currentTrack)
      else if (index < 0) queue.unshift(currentTrack)
      const prepared = await playerRef.current.prepareTransferredPlayback?.({ ...request.snapshot, currentIndex: index }, queue)
      if (!prepared) throw new Error('Autumn could not prepare this song on the device.')
      targetPreparedRef.current.add(request._id)
      await actOnPlaybackHandoff(request._id, deviceId, 'ready')
      setIncoming((value) => value?._id === request._id ? { ...value, state: 'TARGET_READY' } : value)
    } catch (requestError) {
      await actOnPlaybackHandoff(request._id, deviceId, 'failed').catch(() => {})
      setIncomingError(requestError.message || 'Could not prepare playback.')
      setIncoming((value) => value?._id === request._id ? { ...value, state: 'FAILED' } : value)
    } finally { setIncomingBusy(false) }
  }

  const declineIncoming = async () => {
    const request = incomingRef.current
    if (!request || incomingBusy) return
    setIncomingBusy(true)
    try {
      await actOnPlaybackHandoff(request._id, deviceId, 'decline')
      dismissedRef.current.add(request._id)
      setIncoming((value) => value?._id === request._id ? { ...value, state: 'CANCELLED' } : value)
    } catch (requestError) { setIncomingError(requestError.message || 'Could not decline this request.') }
    finally { setIncomingBusy(false) }
  }

  const startIncomingPlayback = async () => {
    const request = incomingRef.current
    if (!request) return
    setIncomingBusy(true)
    try {
      targetNeedsGestureRef.current.delete(request._id)
      const started = await playerRef.current.startPreparedPlayback?.()
      if (!started) throw new Error('Playback did not start. Check the connection and try again.')
      await actOnPlaybackHandoff(request._id, deviceId, 'started')
      targetStartedRef.current.add(request._id)
      setIncoming((value) => value?._id === request._id ? { ...value, state: 'STARTED', error: '' } : value)
      dismissedRef.current.add(request._id)
    } catch (requestError) {
      const result = await actOnPlaybackHandoff(request._id, deviceId, 'failed').catch(() => null)
      setIncoming((value) => value?._id === request._id ? { ...value, state: result?.state || 'READY_TO_START', ownerRestored: result?.ownerRestored, error: requestError.message || 'Playback could not start.' } : value)
      setIncomingError(requestError.message || 'Playback could not start.')
    }
    finally { setIncomingBusy(false) }
  }

  const retryRegistration = async () => {
    const device = await registerConnectDevice(deviceId)
    registrationReadyRef.current = true
    setRegisteredDevice(device)
    setRegistrationError(null)
    return device
  }

  const value = { deviceId, registeredDevice, registrationError, retryRegistration, transfer, movePlayback, hasTransferablePlayback: Boolean(player.currentTrack), transferInProgress: Boolean(transfer && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(transfer.state)) }
  return <ConnectContext.Provider value={value}>
    {children}
    {incoming && !['CANCELLED', 'EXPIRED'].includes(incoming.state) && <IncomingHandoff
      request={incoming}
      busy={incomingBusy}
      error={incomingError || incoming.error || ''}
      onAccept={() => void acceptIncoming()}
      onDecline={() => void declineIncoming()}
      onStart={() => void startIncomingPlayback()}
      onDismiss={() => { dismissedRef.current.add(incoming._id); setIncoming(null); setIncomingError('') }}
    />}
    {transfer?.uiState && <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-white/10 bg-[#171817] px-4 py-3 text-sm text-white shadow-2xl">{transfer.uiState}</div>}
  </ConnectContext.Provider>
}

function IncomingHandoff({ request, busy, error, onAccept, onDecline, onStart, onDismiss }) {
  const track = request.snapshot?.track || {}
  const terminal = ['STARTED', 'FAILED'].includes(request.state)
  const needsStart = request.state === 'READY_TO_START'
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="incoming-handoff-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#171817] p-5 text-white shadow-2xl sm:p-6">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6a44a]/15 text-[#e6a44a]"><Radio size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-[#d29a55]">Autumn Connect</p><h2 id="incoming-handoff-title" className="font-['Space_Grotesk'] text-xl font-bold">{request.state === 'STARTED' ? 'Playback moved here' : 'Continue playing here?'}</h2></div></div>
      <p className="mt-4 text-sm text-white/60">Continue playback from <span className="font-semibold text-white">{request.sourceDeviceName || 'another device'}</span>.</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">{track.image && <img src={track.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold">{track.title || track.name || 'Current track'}</p><p className="mt-1 truncate text-sm text-white/50">{track.artist || track.subtitle || 'Artist unavailable'}</p></div></div>
      {request.state === 'PREPARING' || request.state === 'TARGET_READY' || request.state === 'COMMITTED' ? <p className="mt-4 text-sm text-white/60">{request.state === 'PREPARING' ? 'Preparing song...' : request.state === 'TARGET_READY' ? 'Waiting for the source device...' : 'Playback is ready here.'}</p> : null}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      {terminal ? <button type="button" onClick={onDismiss} className="mt-5 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/8">Close</button> : needsStart ? <button type="button" disabled={busy} onClick={onStart} className="mt-5 w-full rounded-lg bg-[#e6a44a] px-4 py-3 text-sm font-bold text-[#21160a] disabled:opacity-50">{busy ? 'Starting...' : 'Play Here'}</button> : request.state === 'PENDING' ? <div className="mt-5 flex gap-3"><button type="button" disabled={busy} onClick={onDecline} className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/8 disabled:opacity-50">Decline</button><button type="button" disabled={busy} onClick={onAccept} className="flex-1 rounded-lg bg-[#e6a44a] px-4 py-3 text-sm font-bold text-[#21160a] disabled:opacity-50">{busy ? 'Preparing...' : 'Play Here'}</button></div> : null}
    </section>
  </div>
}

export const useConnect = () => {
  const context = useContext(ConnectContext)
  if (!context) throw new Error('useConnect must be used inside ConnectProvider')
  return context
}