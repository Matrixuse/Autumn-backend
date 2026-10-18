import { OpenAPIHono } from '@hono/zod-openapi'
import { getCookie } from 'hono/cookie'
import type { Routes } from '#common/types'
import { AuthError, AuthService } from '#modules/auth/services'
import { RecommendationEventsBatchModel } from '#modules/recommendations/models'
import { RecommendationService } from '#modules/recommendations/services'

const SESSION_COOKIE = 'jiosaavn_session'
const getRequestSessionToken = (ctx: { req: { header: (name: string) => string | undefined } }) => {
  const headerValue = ctx.req.header('Authorization')
  if (headerValue?.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim()
  return getCookie(ctx, SESSION_COOKIE)
}

export class RecommendationController implements Routes {
  public controller = new OpenAPIHono()
  private readonly authService: Pick<AuthService, 'getUserBySession'>
  private readonly recommendationService: Pick<
    RecommendationService,
    'getProfile' | 'recordEvents' | 'getPastPlaysSnapshot'
  >

  constructor(
    authService: Pick<AuthService, 'getUserBySession'> = new AuthService(),
    recommendationService: Pick<
      RecommendationService,
      'getProfile' | 'recordEvents' | 'getPastPlaysSnapshot'
    > = new RecommendationService()
  ) {
    this.authService = authService
    this.recommendationService = recommendationService
  }

  public initRoutes() {
    this.controller.get('/recommendations/profile', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const profile = await this.recommendationService.getProfile(user.id)
      return ctx.json({ success: true, data: profile })
    })

    this.controller.post('/recommendations/events', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      let payload: unknown
      try {
        payload = await ctx.req.json()
      } catch {
        return ctx.json({ success: false, message: 'Invalid recommendation events' }, 400)
      }
      const parsed = RecommendationEventsBatchModel.safeParse(payload)
      if (!parsed.success) {
        return ctx.json({ success: false, message: 'Invalid recommendation events' }, 400)
      }

      try {
        const result = await this.recommendationService.recordEvents(user.id, parsed.data.events)
        return ctx.json({ success: true, data: result })
      } catch (error) {
        if (error instanceof Error && error.message === 'Invalid user ID') {
          throw new AuthError('Invalid session', 401)
        }
        throw error
      }
    })

    this.controller.post('/recommendations/past-plays', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      let payload: unknown
      try {
        payload = await ctx.req.json()
      } catch {
        return ctx.json({ success: false, message: 'Invalid Past Plays payload' }, 400)
      }

      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
      const history = Array.isArray(body.history) ? body.history : []
      const events = Array.isArray(body.events) ? body.events : []

      try {
        const snapshot = await this.recommendationService.getPastPlaysSnapshot(user.id, events, history)
        return ctx.json({ success: true, data: snapshot })
      } catch (error) {
        if (error instanceof Error && error.message === 'Invalid user ID') {
          throw new AuthError('Invalid session', 401)
        }
        throw error
      }
    })
  }
}
