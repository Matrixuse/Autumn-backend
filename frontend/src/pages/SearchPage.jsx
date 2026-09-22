import { Clock3, Search, Trash2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { getBestImageUrl } from '../utils/mediaQuality'

const getLabel = (item) => item?.__type === 'artist' ? item?.name || item?.title : item?.title || item?.name || 'Unknown result'
const getMeta = (item) => {
  if (item?.__type === 'artist') return 'Artist'
  const artist = item?.artists?.primary?.map((artist) => artist.name).join(', ') || item?.artist || item?.subtitle || 'Song'
  return `${artist}${item?.album ? ` • ${item.album}` : ''}`
}
const getImage = (item) => {
  if (typeof item?.image === 'string') return item.image
  return getBestImageUrl(item?.image || item?.cover || item?.thumbnail || [])
}

export default function SearchPage() {
  const { searchState = {} } = useOutletContext() || {}
  const { query = '', history = [], results = [], loading = false } = searchState
  const isSearching = query.trim().length > 0
  const hasSearchContent = isSearching || history.length > 0
  const dispatchCommand = (detail) => window.dispatchEvent(new CustomEvent('autumn-search-command', { detail }))

  return (
    <section className="mx-auto w-full max-w-3xl px-1 lg:flex lg:min-h-[60vh] lg:flex-col lg:items-center lg:justify-center lg:text-center">
      {!hasSearchContent && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/6 text-[#e6a44a]">
            <Search size={28} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">Find your next repeat</p>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold sm:text-4xl">Search music</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/45">Look through songs, albums, artists, and playlists.</p>
        </div>
      )}

      {hasSearchContent && (
        <div className="mx-auto w-full max-w-2xl pt-6 lg:hidden">
          <p className="mb-3 px-1 text-left text-xs font-bold uppercase tracking-[.2em] text-[#d29a55]">
            {isSearching ? 'Search results' : 'Recent searches'}
          </p>
          <div className="overflow-hidden bg-[#17191a]/5">
            {!isSearching ? history.map((item) => (
              <div key={item} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-b-0">
                <button type="button" onClick={() => dispatchCommand({ type: 'select-history', value: item })} className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm font-medium text-white/85">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 text-white/60"><Clock3 size={14} /></span>
                  <span className="truncate">{item}</span>
                </button>
                <button type="button" onClick={() => dispatchCommand({ type: 'remove-history', value: item })} className="rounded-md p-2 text-white/40 hover:bg-white/5 hover:text-white/80" aria-label={`Remove ${item}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            )) : loading ? (
              <p className="px-4 py-4 text-left text-sm text-white/50">Searching...</p>
            ) : results.length > 0 ? results.map((item) => (
              <button key={item.id} type="button" onClick={() => dispatchCommand({ type: 'select-result', value: getLabel(item), item })} className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left last:border-b-0 hover:bg-white/5">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                  {getImage(item) ? <img src={getImage(item)} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-white/60"><Search size={14} /></span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{getLabel(item)}</span>
                  <span className="mt-0.5 block truncate text-xs text-white/45">{getMeta(item)}</span>
                </span>
              </button>
            )) : (
              <p className="px-4 py-4 text-left text-sm text-white/50">No results found</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
