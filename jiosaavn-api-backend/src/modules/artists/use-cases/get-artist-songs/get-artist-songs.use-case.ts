import { Endpoints } from '#common/constants'
import { useFetch } from '#common/helpers'
import { createSongPayload } from '#modules/songs/helpers'
import { HTTPException } from 'hono/http-exception'
import type { IUseCase } from '#common/types'
import type { ArtistSongAPIResponseModel, ArtistSongModel } from '#modules/artists/models'
import type { z } from 'zod'

type ArtistSong = z.infer<typeof ArtistSongAPIResponseModel>['topSongs']['songs'][number]

const dailyCatalogCache = new Map<string, { total: number; songs: ArtistSong[] }>()

const getDailySeed = () => new Date().toISOString().slice(0, 10)

const getSeedValue = (value: string) => {
  let seed = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }

  return seed >>> 0
}

const shuffleSongs = (songs: ArtistSong[], seedText: string) => {
  const shuffled = [...songs]
  let seed = getSeedValue(seedText)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const swapIndex = seed % (index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

export interface GetArtistSongsArgs {
  artistId: string
  page: number
  limit: number
  sortBy: 'popularity' | 'latest' | 'alphabetical'
  sortOrder: 'asc' | 'desc'
}

export class GetArtistSongsUseCase implements IUseCase<GetArtistSongsArgs, z.infer<typeof ArtistSongModel>> {
  constructor() {}

  async execute({ artistId, limit, sortOrder, sortBy }: GetArtistSongsArgs) {
    const cacheKey = `${artistId}:${getDailySeed()}:${limit}:${sortBy}:${sortOrder}`
    let catalog = dailyCatalogCache.get(cacheKey)

    if (!catalog) {
      const songs = new Map<string, ArtistSong>()
      let total = 0
      let currentPage = 0
      const pageSize = 10

      while (currentPage === 0 || (songs.size < limit && songs.size < total)) {
        const { data } = await useFetch<z.infer<typeof ArtistSongAPIResponseModel>>({
          endpoint: Endpoints.artists.songs,
          params: {
            artistId,
            page: currentPage,
            n_song: Math.min(pageSize, limit),
            sort_order: sortOrder,
            category: sortBy
          }
        })

        if (!data) break

        total = data.topSongs.total
        data.topSongs.songs.forEach((song) => songs.set(song.id, song))

        if (!data.topSongs.songs.length) break
        currentPage += 1
      }

      catalog = { total, songs: [...songs.values()] }
      dailyCatalogCache.set(cacheKey, catalog)
    }

    if (!catalog.songs.length) throw new HTTPException(404, { message: 'artist songs not found' })

    const selectedSongs = shuffleSongs(catalog.songs, `${artistId}:${getDailySeed()}`).slice(0, limit)

    return {
      total: catalog.total,
      songs: selectedSongs.map((song) => createSongPayload(song))
    }
  }
}
