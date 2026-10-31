import { OpenAPIHono } from '@hono/zod-openapi'
import { getCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Routes } from '#common/types'
import { AuthService } from '#modules/auth/services'
import { AccountDataPatchModel } from '#modules/account-data/models'
import { AccountDataService } from '#modules/account-data/services'

const SESSION_COOKIE = 'jiosaavn_session'
const getRequestSessionToken = (ctx: Context) => {
  const headerValue = ctx.req.header('Authorization')
  if (headerValue?.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim()
  return getCookie(ctx, SESSION_COOKIE)
}

export class AccountDataController implements Routes {
  public controller = new OpenAPIHono()
  private readonly authService: Pick<AuthService, 'getUserBySession'>
  private readonly accountDataService: Pick<AccountDataService, 'get' | 'patch' | 'importLocalData'>

  constructor(
    authService: Pick<AuthService, 'getUserBySession'> = new AuthService(),
    accountDataService: Pick<AccountDataService, 'get' | 'patch' | 'importLocalData'> = new AccountDataService()
  ) {
    this.authService = authService
    this.accountDataService = accountDataService
  }

  public initRoutes() {
    this.controller.get('/account/data', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const data = await this.accountDataService.get(user.id)
      return ctx.json({ success: true, data })
    })

    this.controller.patch('/account/data', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const input = AccountDataPatchModel.safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid account data' }, 400)
      const data = await this.accountDataService.patch(user.id, input.data)
      return ctx.json({ success: true, data })
    })

    this.controller.post('/account/data/import', async (ctx) => {
      const user = await this.authService.getUserBySession(getRequestSessionToken(ctx))
      const input = AccountDataPatchModel.safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid account data import' }, 400)
      const data = await this.accountDataService.importLocalData(user.id, input.data)
      return ctx.json({ success: true, data })
    })
  }
}
