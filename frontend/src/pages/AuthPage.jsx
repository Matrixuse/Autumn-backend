import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Music2, Sparkles } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from '../components/common/Loader'

const artwork = ['from-[#173f4e] via-[#1497b1] to-[#171a2f]', 'from-[#5b321f] via-[#bd7236] to-[#1e252c]', 'from-[#351d4d] via-[#c34872] to-[#e9b56b]']

function ArtPanel() {
  return (
    <div className="relative hidden min-h-full overflow-hidden border-r border-white/10 bg-[#080b0c] p-10 lg:flex lg:w-[48%] lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-[#0c90ad]/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#d28b3d]/15 blur-3xl" />
        <div className="relative flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full border border-[#1baaca] bg-[#101a1d] text-[#42d4ee]"><Sparkles size={17} /></div><span className="font-['Bahnschrift_Condensed'] text-2xl font-semibold">Autumn</span></div>
        <div className="relative">
            <p className="mb-4 text-xs font-bold uppercase tracking-[.25em] text-[#e6a44a]">
                Your listening space
            </p>
            <h2 className="max-w-md font-['Space_Grotesk'] text-5xl font-bold leading-[1.05]">
                Come for the sound.
                <br />
                <span className="text-[#46c3db]">
                    Stay for the mood.
                </span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-white/50">
                Keep your favorites close, discover your next repeat, and make every quiet moment yours.
            </p>
            <div className="mt-10 flex items-end gap-3">
                {artwork.map((color, index) => 
                <div key={color} className={`relative h-28 w-24 overflow-hidden rounded-xl bg-linear-to-br ${color} shadow-2xl ${index === 1 ? 'h-36 w-28 -translate-y-2' : ''}`}>
                    <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
                    <span className="absolute bottom-3 inset-x-0 text-center text-[9px] font-bold tracking-[.25em] text-white/80">
                        AUTUMN
                    </span>
                </div>
                )}
            </div>
        </div>
        <p className="relative text-xs text-white/30">
            A calmer way to listen.
        </p>
    </div>
  )
}

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle, signup, isAuthenticated, loading } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const googleButtonRef = useRef(null)

  useEffect(() => {
    if (!isLogin || !googleButtonRef.current) return undefined
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setError('Google sign-in is not configured.')
      return undefined
    }

    let resizeObserver
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setError('')
          setSubmitting(true)
          try {
            await loginWithGoogle(response.credential)
            navigate(location.state?.from || '/', { replace: true })
          } catch (requestError) {
            setError(requestError.response?.data?.message || 'Google sign-in failed. Please try again.')
          } finally { setSubmitting(false) }
        }
      })
            const renderGoogleButton = () => {
                if (!googleButtonRef.current) return
                googleButtonRef.current.replaceChildren()
                const width = Math.min(420, Math.max(240, googleButtonRef.current.clientWidth))
                window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'filled_black', size: 'large', width, text: 'continue_with', shape: 'rectangular' })
            }

            renderGoogleButton()
            resizeObserver = new ResizeObserver(renderGoogleButton)
            resizeObserver.observe(googleButtonRef.current)
    }

    const existingScript = document.querySelector('script[data-google-identity]')
    if (existingScript) {
      initializeGoogle()
            return () => resizeObserver?.disconnect()
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = initializeGoogle
    document.head.appendChild(script)
    return () => resizeObserver?.disconnect()
  }, [isLogin, location.state, loginWithGoogle, navigate])

  if (!loading && isAuthenticated) return <Navigate to={location.state?.from || '/'} replace />

    const redirectMessage = location.state?.message

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await (isLogin ? login({ email: form.email, password: form.password }) : signup(form))
      navigate(location.state?.from || '/', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_95%_0%,#252313_0%,transparent_30%),#050505] p-2 text-white sm:p-6 md:p-8 lg:min-h-screen lg:p-0">
        <div className="mx-auto flex min-h-[calc(100dvh-16px)] max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0b] shadow-2xl sm:min-h-[calc(100dvh-48px)] sm:rounded-3xl md:min-h-[calc(100dvh-64px)] lg:min-h-screen lg:max-w-none lg:rounded-none lg:border-0">
            <ArtPanel />
            <section className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8 md:px-14 lg:px-20 lg:py-10">
                <div className="flex items-center gap-2 lg:hidden">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#101a1d] text-[#42d4ee]">
                        <Sparkles size={15} />
                    </div>
                    <span className="font-['Bahnschrift_Condensed'] text-xl font-semibold">
                        Autumn
                    </span>
                </div>
                <div className="my-auto w-full max-w-md self-center">
                    <div className="mb-9">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
                            {isLogin ? 'Welcome back' : 'Create your space'}
                        </p>
                        <h1 className="font-['Space_Grotesk'] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                            {isLogin ? 'Pick up where you left off.' : 'Make room for your sound.'}
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-white/45">
                            {isLogin ? 'Your playlists and favorite moments are waiting.' : 'Start a personal listening space built around you.'}
                        </p>
                    </div>
                    {redirectMessage && <p className="mb-5 rounded-xl border border-[#e6a44a]/25 bg-[#e6a44a]/10 px-4 py-3 text-sm text-[#f1c77f]">{redirectMessage}</p>}
                    <form onSubmit={submit} className="space-y-4">
                        {!isLogin && 
                        <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-white/60">
                                Username
                            </span>
                            <input required minLength="3" maxLength="32" pattern="[a-zA-Z0-9_]+" autoComplete="username" name="username" value={form.username} onChange={update} placeholder="Enter Username" className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-[#e6a44a] focus:bg-white/9" />
                        </label>}
                        <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-white/60">
                                Email
                            </span>
                            <input required type="email" autoComplete="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-[#e6a44a] focus:bg-white/9" />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-white/60">
                                Password
                            </span>
                            <div className="relative">
                                <input required minLength="8" maxLength="128" autoComplete={isLogin ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={update} placeholder="At least 8 characters" className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 pr-12 text-sm outline-none transition placeholder:text-white/25 focus:border-[#e6a44a] focus:bg-white/9" />
                                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </label>
                        {error && (
                            <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                                {error}
                            </p>
                        )}
                        <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e6a44a] px-4 py-3.5 text-sm font-bold text-[#21160a] transition hover:bg-[#f1b65d] disabled:cursor-not-allowed disabled:opacity-60">
                            {submitting ? (
                                    <Loader label={isLogin ? 'Signing in' : 'Creating account'} />
                            ) : (
                                <>
                                    {isLogin ? 'Log in' : 'Create account'}
                                    <ArrowRight size={17} />
                                </>
                            )}
                        </button>
                    </form>
                    <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[.16em] text-white/25">
                        <span className="h-px flex-1 bg-white/10" />
                        secure session
                        <span className="h-px flex-1 bg-white/10" />
                    </div>
                    {isLogin && 
                    <>
                        <div ref={googleButtonRef} className="mb-5 flex min-h-12 justify-center overflow-hidden rounded-xl" />
                    </>}
                    <p className="text-center text-sm text-white/45">
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <Link to={isLogin ? '/signup' : '/login'} className="font-bold text-[#e6a44a] hover:text-[#f1b65d]">
                            {isLogin ? 'Sign up' : 'Log in'}
                        </Link>
                    </p>
                </div>
                <div className="mt-auto flex items-center justify-center gap-2 text-xs text-white/25">
                    <Music2 size={14} /> Autumn · Your music, your season
                </div>
            </section>
        </div>
    </main>
  )
}