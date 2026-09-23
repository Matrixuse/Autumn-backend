import { Endpoints } from '#common/constants'
import { useFetch } from '#common/helpers'
import { GetSongByIdUseCase } from '#modules/songs/use-cases'
import { HTTPException } from 'hono/http-exception'

export class GetSongLyricsUseCase {
  private readonly getSongByIdUseCase: GetSongByIdUseCase

  constructor() {
    this.getSongByIdUseCase = new GetSongByIdUseCase()
  }

  async execute(songId: string) {
    const songs = await this.getSongByIdUseCase.execute({ songIds: songId })
    const lyricsId = songs[0]?.lyricsId
    if (!lyricsId) return { lyrics: '', hasLyrics: false }

    const { data } = await useFetch<Record<string, unknown>>({
      endpoint: Endpoints.songs.lyrics,
      params: { lyrics_id: lyricsId }
    })

    const lyrics = String(data?.lyrics || data?.lyrics_snippet || '')
    if (!lyrics) throw new HTTPException(404, { message: 'lyrics not found' })
    return { lyrics, hasLyrics: true }
  }
}
