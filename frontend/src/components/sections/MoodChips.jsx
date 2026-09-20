import { useNavigate } from 'react-router-dom'

const moods = ['Relax', 'Romance', 'Feel good', 'Party', 'Energise', 'Sad', 'Focus', 'Work out', 'Sleep']

export default function MoodChips() {
    const navigate = useNavigate()

    return (
        <div className="scrollbar-none flex gap-3 overflow-x-auto">
            {moods.map((mood) => (
                <button
                    key={mood}
                    type="button"
                    onClick={() => navigate(`/mood/${encodeURIComponent(mood)}`)}
                    className="whitespace-nowrap rounded-lg border border-white/4 bg-[#1f2325] px-3 py-1 text-xs font-semibold text-white/85 transition hover:bg-[#33373a]"
                >
                    {mood}
                </button>
            ))}
        </div>
    )
}