import { z } from 'zod'

export const LikedSongModel = z.record(z.string(), z.unknown()).refine(
  (song) => {
    const id = song.id ?? song._id
    return (
      (typeof id === 'string' || typeof id === 'number') && String(id).trim().length > 0 && String(id).length <= 128
    )
  },
  { message: 'A song ID is required' }
)

export const LikedSongIdModel = z.string().trim().min(1).max(128)
export const SaveLikedSongModel = z.object({ song: LikedSongModel }).strict()
export const SyncLikedSongsModel = z.object({ songs: z.array(LikedSongModel).max(500) }).strict()

export type LikedSong = z.infer<typeof LikedSongModel>

export const getLikedSongId = (song: LikedSong) => String(song.id ?? song._id).trim()
