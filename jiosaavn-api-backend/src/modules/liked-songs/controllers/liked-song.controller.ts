import { OpenAPIHono } from '@hono/zod-openapi'
import { getCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Routes } from '#common/types'
import { AuthService } from '#modules/auth/services'
import { LikedSongIdModel, SaveLikedSongModel, SyncLikedSongsModel } from '#modules/liked-songs/models'
import { LikedSongService } from '#modules/liked-songs/services'

const SESSION_COOKIE = 'jiosaavn_session'
const getRequestSessionToken = (ctx: Context) => {
  const headerValue = ctx.req.header('Authorization')
  if (headerValue?.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim()
  return getCookie(ctx, SESSION_COOKIE)
}

export class LikedSongController implements Routes {
  public controller = new OpenAPIHono()
  private readonly authService: Pick<AuthService, 'getUserBySession'>
  private readonly likedSongService: Pick<
    LikedSongService,
    'getLikedSongs' | 'syncLikedSongs' | 'saveLikedSong' | 'removeLikedSong'
  >

  constructor(
    authService: Pick<AuthService, 'getUserBySession'> = new AuthService(),
    likedSongService: Pick<
      LikedSongService,
      'getLikedSongs' | 'syncLikedSongs' | 'saveLikedSong' | 'removeLikedSong'
    > = new LikedSongService()
  ) {
    this.authService = authService
    this.likedSongService = likedSongService
  }

  public initRoutes() {
    this.controller.get('/liked-songs', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const songs = await this.likedSongService.getLikedSongs(user.id)
      return ctx.json({ success: true, data: { songs } })
    })

    this.controller.post('/liked-songs/sync', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const payload = await ctx.req.json().catch(() => null)
      const input = SyncLikedSongsModel.safeParse(payload)
      if (!input.success) return ctx.json({ success: false, message: 'Invalid liked songs' }, 400)
      const songs = await this.likedSongService.syncLikedSongs(user.id, input.data.songs)
      return ctx.json({ success: true, data: { songs } })
    })

    this.controller.put('/liked-songs/:songId', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const songId = LikedSongIdModel.safeParse(ctx.req.param('songId'))
      const payload = await ctx.req.json().catch(() => null)
      const input = SaveLikedSongModel.safeParse(payload)
      if (!songId.success || !input.success) return ctx.json({ success: false, message: 'Invalid liked song' }, 400)
      const bodySongId = String(input.data.song.id ?? input.data.song._id).trim()
      if (bodySongId !== songId.data)
        return ctx.json({ success: false, message: 'Song ID does not match the request' }, 400)
      const song = await this.likedSongService.saveLikedSong(user.id, input.data.song)
      return ctx.json({ success: true, data: { song } })
    })

    this.controller.delete('/liked-songs/:songId', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const songId = LikedSongIdModel.safeParse(ctx.req.param('songId'))
      if (!songId.success) return ctx.json({ success: false, message: 'Invalid song ID' }, 400)
      const result = await this.likedSongService.removeLikedSong(user.id, songId.data)
      return ctx.json({ success: true, data: result })
    })
  }
}
