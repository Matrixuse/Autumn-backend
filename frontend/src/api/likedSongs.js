import axiosInstance from './axiosInstance'

const readSongs = (response) => {
  const songs = response.data?.data?.songs
  return Array.isArray(songs) ? songs : []
}

export const fetchLikedSongs = async () => readSongs(await axiosInstance.get('/liked-songs'))

export const importLikedSongs = async (songs) =>
  readSongs(await axiosInstance.post('/liked-songs/sync', { songs }))

export const saveLikedSong = (song) =>
  axiosInstance.put(`/liked-songs/${encodeURIComponent(String(song.id))}`, { song })

export const deleteLikedSong = (songId) =>
  axiosInstance.delete(`/liked-songs/${encodeURIComponent(String(songId))}`)
