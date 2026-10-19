import { ArrowLeft, ChevronRight, Copy, Info, Radio, SlidersHorizontal, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'

const items = [
  { to: '/settings/continue-anywhere', icon: Radio, title: 'Continue Anywhere', description: 'Move your music between devices & continue listening from where you left off.' },
  { to: '/equalizer', icon: SlidersHorizontal, title: 'Equalizer', description: 'Tune the sound to suit your listening.' }
]

export default function Settings() {
  const navigate = useNavigate()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const {
    isGaplessPlaybackEnabled,
    setIsGaplessPlaybackEnabled,
    isDataSavingEnabled,
    setIsDataSavingEnabled,
    isAutoplayEnabled,
    setIsAutoplayEnabled
  } = usePlayer()

  const copyDebugLog = async () => {
    const log = window.__autumnLog?.() || '[]'
    try {
      await navigator.clipboard.writeText(log)
      setLogCopied(true)
      window.setTimeout(() => setLogCopied(false), 1800)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = log
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setLogCopied(true)
      window.setTimeout(() => setLogCopied(false), 1800)
    }
  }

  useEffect(() => {
    if (!aboutOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setAboutOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [aboutOpen])

  return (
    <div className="mx-auto w-full max-w-3xl text-white">
      <div className="mb-8 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full bg-white/6 p-2 hover:bg-white/12"><ArrowLeft size={20} /></button>
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d29a55]">Account</p><h1 className="font-['Space_Grotesk'] text-2xl lg:text-3xl font-semibold">Settings</h1></div>
      </div>
      <section aria-label="Settings" className="divide-y divide-white/10 border-y border-white/10">
        {items.map(({ to, icon: Icon, title, description }) => 
        <Link key={to} to={to} className="flex min-w-0 items-center gap-2 py-2 transition hover:bg-white/[0.03] sm:px-1">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/70"><Icon size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-xs leading-5 text-white/50">{description}</span></span>
          <ChevronRight size={20} className="shrink-0 text-white/40" />
        </Link>)}
      </section>

      <section aria-labelledby="playback-settings-title" className="mt-5 border-y border-white/10">
        <h2 id="playback-settings-title" className="py-4 text-lg font-semibold">Playback</h2>
        <PreferenceRow
          title="Gapless playback"
          description="Preload the next queued track to reduce pauses between songs. Your browser may still add a short transition."
          checked={isGaplessPlaybackEnabled}
          onChange={setIsGaplessPlaybackEnabled}
        />
        <PreferenceRow
          title="Data saving"
          description="Use the lowest available audio bitrate for tracks started after changing this setting."
          checked={isDataSavingEnabled}
          onChange={setIsDataSavingEnabled}
        />
        <PreferenceRow
          title="Autoplay"
          description="Continue automatically through Up Next when a track finishes."
          checked={isAutoplayEnabled}
          onChange={setIsAutoplayEnabled}
        />
      </section>

      <section aria-label="About Autumn" className="border-y border-white/10">
        <button type="button" onClick={() => setAboutOpen(true)} aria-haspopup="dialog" className="flex w-full items-center gap-2 py-4 text-left hover:bg-white/[0.03] sm:px-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/70"><Info size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">About Autumn</span><span className="block text-xs leading-5 text-white/50">App information and credits</span></span>
          <ChevronRight size={20} className="shrink-0 text-white/40" />
        </button>
      </section>

      <section aria-label="Debug log" className="border-b border-white/10">
        <div className="flex items-center gap-4 py-4 sm:px-3">
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Debug log</span><span className="mt-1 block text-xs leading-5 text-white/50">Copy recent app and playback lifecycle events.</span></span>
          <button type="button" onClick={copyDebugLog} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10">
            <Copy size={16} />{logCopied ? 'Copied' : 'Copy log'}
          </button>
        </div>
      </section>

      {aboutOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAboutOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="about-autumn-title" className="w-full max-w-md rounded-xl border border-white/10 bg-[#171817] p-5 text-white shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3"><img src="/logo2.png" alt="" className="h-10 w-10" /><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d29a55]">Music player</p><h2 id="about-autumn-title" className="font-['Space_Grotesk'] text-2xl font-bold">About Autumn</h2></div></div>
            <button type="button" onClick={() => setAboutOpen(false)} aria-label="Close About Autumn" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
          <p className="mt-5 text-sm leading-6 text-white/65">Autumn brings music discovery, your listening library, and playback controls together in one place.</p>
          <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/40">Autumn Player</p>
        </section>
      </div>}
    </div>
  )
}

function PreferenceRow({ title, description, checked, onChange }) {
  return <label className="flex cursor-pointer items-center gap-4 border-t border-white/10 py-4 sm:px-3">
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-white/50">{description}</span></span>
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-white/20 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e6a44a] has-[:checked]:bg-blue-400">
      <input type="checkbox" role="switch" aria-label={title} checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
      <span aria-hidden="true" className="pointer-events-none ml-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </span>
  </label>
}