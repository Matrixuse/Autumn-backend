import { useNavigate, useLocation } from 'react-router-dom'

const moods = ['Relax', 'Romance', 'Feel good', 'Party', 'Energise', 'Sad', 'Focus', 'Work out', 'Sleep']

export default function MoodChips() {
    const navigate = useNavigate()
    const location = useLocation()
    const isHomePage = location.pathname === '/'

    return (
        <div className="scrollbar-none flex gap-3 overflow-x-auto">
            {moods.map((mood) => (
                <button
                    key={mood}
                    type="button"
                    onClick={() => navigate(`/mood/${encodeURIComponent(mood)}`)}
                    className={`${isHomePage ? 'bg-white/7' : 'bg-[#1f2325]'} whitespace-nowrap rounded-lg px-3 py-1 text-sm font-semibold text-white/85 transition hover:bg-[#33373a]`}
                >
                    {mood}
                </button>
            ))}
        </div>
    )
}