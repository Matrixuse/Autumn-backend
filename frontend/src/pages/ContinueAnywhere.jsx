import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Clock3, Laptop, LoaderCircle, Pencil, Radio, Smartphone, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getConnectDeviceId, getConnectErrorMessage, listConnectDevices, revokeConnectDevice, updateConnectDevice } from '../api/connect'
import { useConnect } from '../context/ConnectContext'

const formatLastSeen = (value) => {
  const age = Math.max(0, Date.now() - new Date(value).getTime())
  if (age < 60_000) return 'Just now'
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} hr ago`
  return new Date(value).toLocaleDateString()
}

export default function ContinueAnywhere() {
  const navigate = useNavigate()
  const { movePlayback, hasTransferablePlayback, transferInProgress, transfer, registeredDevice, registrationError, retryRegistration } = useConnect()
  const [deviceId] = useState(() => getConnectDeviceId())
  const [devices, setDevices] = useState([])
  const [enabled, setEnabled] = useState(null)
  const [allowReceiving, setAllowReceiving] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listConnectDevices(deviceId)
      setDevices(result.devices || [])
      const current = (result.devices || []).find((device) => device.isCurrent)
      setEnabled(current?.enabled ?? null)
      setAllowReceiving(current?.allowReceiving ?? null)
    } catch (requestError) {
      setDevices([])
      setEnabled(null)
      setAllowReceiving(null)
      setError(getConnectErrorMessage(requestError, 'Could not load your devices.'))
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    if (registeredDevice) void refresh()
    else if (registrationError) {
      setLoading(false)
      setError(getConnectErrorMessage(registrationError, 'Could not register this device.'))
    }
  }, [refresh, registeredDevice, registrationError])

  const retry = async () => {
    if (registeredDevice) {
      await refresh()
      return
    }
    setLoading(true)
    setError('')
    try {
      await retryRegistration()
    } catch (requestError) {
      setLoading(false)
      setError(getConnectErrorMessage(requestError, 'Could not register this device.'))
    }
  }

  const saveCurrentSetting = async (updates, messageText) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateConnectDevice(deviceId, updates)
      if (typeof updates.enabled === 'boolean') setEnabled(updates.enabled)
      if (typeof updates.allowReceiving === 'boolean') setAllowReceiving(updates.allowReceiving)
      setMessage(messageText)
      await refresh()
    } catch (requestError) {
      setError(getConnectErrorMessage(requestError, 'Could not save this setting.'))
    } finally {
      setSaving(false)
    }
  }

  const saveName = async (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length > 48) {
      setError('Enter a device name between 1 and 48 characters.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateConnectDevice(editing, { name: trimmedName })
      setEditing(null)
      setMessage('Device name updated.')
      await refresh()
    } catch (requestError) {
      setError(getConnectErrorMessage(requestError, 'Could not rename this device.'))
    } finally {
      setSaving(false)
    }
  }

  const removeDevice = async (device) => {
    if (!window.confirm(`Remove ${device.name} from your devices?`)) return
    setError('')
    try {
      await revokeConnectDevice(device.deviceId)
      setMessage(`${device.name} was removed.`)
      await refresh()
    } catch (requestError) {
      setError(getConnectErrorMessage(requestError, 'Could not remove this device.'))
    }
  }

  const startMove = async (device) => {
    setError('')
    setMessage('')
    try {
      await movePlayback(device)
    } catch (requestError) {
      setError(requestError.message || 'Could not start the playback transfer.')
    }
  }

  const current = devices.find((device) => device.isCurrent)
  const others = devices.filter((device) => !device.isCurrent)

  return (
    <div className="mx-auto w-full max-w-3xl text-white">
      <div className="mb-2 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back to Settings" className="rounded-full p-2 hover:bg-white/12"><ArrowLeft size={20} /></button>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d29a55]"><Link to="/settings" className="text-xs hover:text-white">Settings</Link> <ChevronRight size={12} className="inline" /> Devices</p>
          <h1 className="font-['Space_Grotesk'] text-2xl font-semibold lg:text-3xl">Continue Anywhere</h1>
        </div>
      </div>

      <section className="border-y border-white/10 py-4">
        <div className="flex items-start">
          <span className="grid h-13 w-13 shrink-0 place-items-center rounded-xl text-white/90"><Radio size={21} /></span>
          <div className="min-w-0 flex-1">
            <p className="max-w-2xl text-sm leading-6 text-white/55">
                Continue your music on another device without losing current song, playback position or Up Next queue.
            </p>
          </div>
        </div>
        {current ? <div className="mt-3 border-t border-white/10">
          <label className="flex cursor-pointer items-start gap-3 border-b border-white/10 py-5">
            <input type="checkbox" checked={enabled} disabled={saving || loading} onChange={(event) => void saveCurrentSetting({ enabled: event.target.checked }, event.target.checked ? 'Continue Anywhere is enabled on this device.' : 'Continue Anywhere is disabled on this device.')} className="mt-1 h-4 w-4 accent-[#e6a44a]" />
            <span className="flex-1"><span className="block text-sm font-semibold">Enable Continue Anywhere on this device</span><span className="mt-1 block text-sm leading-5 text-white/50">When enabled, this device can participate in playback transfers and appear as an available device to your account.</span></span>
            {saving && <LoaderCircle aria-label="Saving setting" size={17} className="animate-spin text-white/50" />}
          </label>
          <label className="flex cursor-pointer items-start gap-3 border-b border-white/10 py-5">
            <input type="checkbox" checked={allowReceiving} disabled={saving || loading} onChange={(event) => void saveCurrentSetting({ allowReceiving: event.target.checked }, event.target.checked ? 'This device can receive playback.' : 'This device will not receive playback.')} className="mt-1 h-4 w-4 accent-[#e6a44a]" />
            <span><span className="block text-sm font-semibold">Allow this device to receive playback</span><span className="mt-1 block text-sm leading-5 text-white/50">This independent setting removes this device as a transfer target without disabling device registration.</span></span>
          </label>
        </div> : <div role="status" className="mt-3 border-t border-white/10 pt-5">
          <p className="text-sm font-semibold">{loading ? 'Loading device settings...' : 'Device settings unavailable'}</p>
          <p className="mt-1 text-sm leading-5 text-white/50">{error || 'The backend must register this device before its Connect settings can be changed.'}</p>
          {!loading && <button type="button" onClick={() => void retry()} className="mt-3 text-sm font-semibold text-[#e6a44a] hover:text-white">Try again</button>}
        </div>}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
                This Device
            </h2>
            <button 
                type="button" 
                onClick={() => void retry()}
                disabled={loading} 
                className="text-sm font-semibold text-[#e6a44a] hover:text-white disabled:opacity-50"
            >
                Refresh
            </button>
        </div>
        {loading ? <p className="py-6 text-sm text-white/50">Loading registered devices...</p> : current ? <DeviceRow device={current} onRename={() => { setEditing(current.deviceId); setName(current.name) }} /> : error ? <p role="status" className="py-6 text-sm text-rose-300">Device status is unavailable until the backend is updated.</p> : <p className="py-6 text-sm text-white/50">This device is not registered yet.</p>}
      </section>

      <section className="mt-5">
        <h2 className="text-xl font-semibold">Your Devices</h2>
        {loading ? 
        <p className="py-5 text-sm text-white/50">
            Checking device availability...
        </p> : error && !devices.length ? <div className="py-5">
            <p role="alert" className="text-sm text-rose-300">
                {error}
            </p>
            <button 
              type="button"
              onClick={() => void retry()}
              className="mt-3 text-sm font-semibold text-[#e6a44a]"
            >
                Try again
            </button>
        </div> : !others.length ? 
        <div className="mt-4 border-y border-white/10 py-6">
            <p className="font-semibold">
                No other devices connected yet.
            </p>
            <p className="mt-2 text-sm leading-5 text-white/50">
                Open Autumn on another device and sign in with the same account. It will appear here when registered.
            </p>
        </div> : <div className="mt-2 divide-y divide-white/10">
            {others.map((device) => 
            <DeviceRow key={device.deviceId} 
            device={device} 
            onRename={() => { 
            setEditing(device.deviceId); 
            setName(device.name) }} 
            onRemove={() => void removeDevice(device)} 
            onMove={() => void startMove(device)} 
            canMove={device.available && Boolean(current?.isPlaybackOwner) && hasTransferablePlayback && !transferInProgress} />)}
        </div>}
      </section>

      {(message || (error && devices.length > 0)) && <p role="status" className={`mt-5 text-sm ${error ? 'text-rose-300' : 'text-emerald-300'}`}>{error || message}</p>}
      {transfer?.uiState && <p className="mt-4 text-sm text-white/65" role="status">{transfer.uiState}</p>}

      {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
        <form onSubmit={(event) => void saveName(event)} role="dialog" aria-modal="true" aria-labelledby="rename-device-title" className="w-full max-w-sm rounded-xl border border-white/10 bg-[#171817] p-5 shadow-2xl">
          <h2 id="rename-device-title" className="text-lg font-semibold">Rename Device</h2><label className="mt-4 block text-sm text-white/65">Device name<input autoFocus required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-white outline-none focus:border-[#c88d3b]" /></label>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/8">Cancel</button><button disabled={saving} className="rounded-lg bg-[#c88d3b] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save</button></div>
        </form>
      </div>}
    </div>
  )
}

function DeviceRow({ device, onRename, onRemove, onMove, canMove }) {
  const Icon = device.platform === 'android' ? Smartphone : Laptop
  const status = device.status === 'online' ? 'Online' : device.status === 'recently-active' ? 'Recently active' : 'Offline'
  return <div className="flex min-w-0 items-center gap-3 border-b border-white/10 py-4 last:border-b-0">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/75"><Icon size={19} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold">
            {device.name}
        </p>
        {device.isCurrent && <span className="rounded bg-[#e6a44a]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e6a44a]">
            This device
        </span>}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/45"><span>{status}</span><span aria-hidden="true">·</span><Clock3 size={12} /><span>{formatLastSeen(device.lastSeenAt)}</span>{device.isPlaybackOwner && <span className="text-[#e6a44a]">· Playing here</span>}</p>
      <p className="mt-1 text-xs text-white/40">{device.available ? 'Available for playback' : device.isCurrent ? device.enabled ? 'Ready to receive playback' : 'Continue Anywhere disabled' : 'Unavailable for playback'}</p>
    </div>
    <button type="button" onClick={onRename} aria-label={`Rename ${device.name}`} title="Rename device" className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"><Pencil size={16} /></button>
    {onMove && <button type="button" disabled={!canMove} onClick={onMove} className="shrink-0 rounded-lg border border-[#e6a44a]/30 px-3 py-2 text-xs font-semibold text-[#e6a44a] hover:bg-[#e6a44a]/10 disabled:cursor-not-allowed disabled:opacity-35">Move Playback</button>}
    {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${device.name}`} title="Remove device" className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-rose-300"><Trash2 size={16} /></button>}
  </div>
}