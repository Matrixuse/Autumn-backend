export const sortSongs = (songs, sortMode = 'ascending') => {
  const sortedSongs = Array.isArray(songs) ? [...songs] : []

  if (sortMode === 'descending') return sortedSongs.reverse()
  if (sortMode === 'title') {
    return sortedSongs.sort((first, second) =>
      String(first?.title || first?.name || '').localeCompare(String(second?.title || second?.name || ''), undefined, { sensitivity: 'base' })
    )
  }

  return sortedSongs
}