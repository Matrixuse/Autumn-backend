import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/common/Avatar'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setUsername(user?.username || '')
    setEmail(user?.email || '')
  }, [user])

  const handleSubmit = (event) => {
    event.preventDefault()
    updateProfile({ username: username.trim(), email: email.trim() })
    setMessage('Profile updated')
  }

  return (
    <div className="mx-auto w-full max-w-2xl text-white">
      <div className="mb-8 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full bg-white/6 p-2 hover:bg-white/12"><ArrowLeft size={20} /></button>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">Account</p>
          <h1 className="font-['Space_Grotesk'] text-4xl font-bold">Profile</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/4 p-6 shadow-xl sm:p-8">
        <div className="mb-8 flex items-center gap-4">
          <Avatar label={username || 'User'} image={user?.avatar || user?.image} size="lg" />
          <div><p className="font-semibold">Manage your profile</p><p className="mt-1 text-sm text-white/45">Update the details shown around Autumn.</p></div>
        </div>
        <label className="block text-sm font-semibold text-white/75">Username<input required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#c88d3b]" /></label>
        <label className="mt-5 block text-sm font-semibold text-white/75">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[#c88d3b]" /></label>
        <div className="mt-6 flex items-center gap-3"><button type="submit" className="flex items-center gap-2 rounded-full bg-[#c88d3b] px-5 py-3 text-sm font-bold text-[#21160a]"><Save size={17} />Save changes</button>{message && <span className="text-sm text-emerald-400">{message}</span>}</div>
      </form>
    </div>
  )
}
