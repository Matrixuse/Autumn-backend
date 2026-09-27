import { useEffect, useState } from 'react'
import axiosInstance from '../api/axiosInstance'

export const useLyrics = (song, enabled) => {
  const songId = song?.id
  const hasLyrics = song?.hasLyrics === true
  const [lyricsState, setLyricsState] = useState({ songId: null, lyrics: '', copyright: '' })
  const isCurrentSong = lyricsState.songId === songId

  useEffect(() => {
    if (!enabled || !songId || !hasLyrics || isCurrentSong) return undefined

    const controller = new AbortController()

    axiosInstance.get(`/songs/${encodeURIComponent(songId)}/lyrics`, { signal: controller.signal })
      .then((response) => {
        const data = response.data?.data
        const lyrics = typeof data?.lyrics === 'string' && data.lyrics.trim() ? data.lyrics : ''
        setLyricsState({
          songId,
          lyrics,
          copyright: lyrics ? (data?.copyright || song?.copyright || '') : ''
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLyricsState({ songId, lyrics: '', copyright: '' })
        }
      })

    return () => controller.abort()
  }, [enabled, hasLyrics, isCurrentSong, song?.copyright, songId])

  return {
    lyrics: enabled && hasLyrics && isCurrentSong ? lyricsState.lyrics : '',
    copyright: enabled && hasLyrics && isCurrentSong ? lyricsState.copyright : '',
    loading: enabled && hasLyrics && Boolean(songId) && !isCurrentSong
  }
}