import axiosInstance from './axiosInstance'
import { normalizeLikedSong, normalizeLikedSongs } from '../utils/likedSong'

const readSongs = (response) => {
  const songs = response.data?.data?.songs
  return normalizeLikedSongs(songs)
}

export const fetchLikedSongs = async () => readSongs(await axiosInstance.get('/liked-songs'))

export const importLikedSongs = async (songs) =>
  readSongs(await axiosInstance.post('/liked-songs/sync', { songs: normalizeLikedSongs(songs) }))

export const saveLikedSong = (song) => {
  const normalized = normalizeLikedSong(song)
  if (!normalized) return Promise.reject(new Error('A valid song ID is required to save a liked song.'))
  return axiosInstance.put(`/liked-songs/${encodeURIComponent(normalized.id)}`, { song: normalized })
}

export const deleteLikedSong = (songId) =>
  axiosInstance.delete(`/liked-songs/${encodeURIComponent(String(songId))}`)
