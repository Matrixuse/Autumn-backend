import { useState } from 'react'
import { ArrowDown01, ArrowDownAZ, ArrowUp10, Check, ListSortDescending } from 'lucide-react'

const sortOptions = [
  { value: 'ascending', label: 'Descending', icon: ArrowDown01 },
  { value: 'descending', label: 'Ascending', icon: ArrowUp10 },
  { value: 'title', label: 'Title wise', icon: ArrowDownAZ },
]

export default function SongSortMenu({ sortMode, onSortChange }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
    }}>
      <button type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-haspopup="true" className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-white/75 hover:text-white">
        <ListSortDescending size={20} />
        Sort
      </button>
      {isOpen && <div role="group" aria-label="Sort songs" className="absolute left-0 top-full z-50 min-w-40 rounded-lg border border-white/10 bg-[#171818] p-1 shadow-xl">
        {sortOptions.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" onClick={() => { onSortChange(value); setIsOpen(false) }} aria-pressed={sortMode === value} className="flex w-full items-center justify-between gap-5 rounded-md px-3 py-2 text-left text-sm text-white/75 hover:bg-white/8 hover:text-white aria-pressed:text-white">
            <span className="flex items-center gap-2"><Icon size={15} />{label}</span>
            {sortMode === value && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>}
    </div>
  )
}
