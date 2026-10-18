import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import type { Routes } from '#common/types'
import { UserModel } from '#modules/auth/models'
import type { Context } from 'hono'
import { AuthService } from '#modules/auth/services'

const SESSION_COOKIE = 'jiosaavn_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400
const getRequestSessionToken = (ctx: Context) => {
  const headerValue = ctx.req.header('Authorization')
  if (headerValue?.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim()
  return getCookie(ctx, SESSION_COOKIE)
}

const getSessionCookieOptions = (requestUrl: string) => {
  const isSecure = new URL(requestUrl).protocol === 'https:'

  return {
    httpOnly: true,
    sameSite: isSecure ? ('None' as const) : ('Lax' as const),
    secure: isSecure,
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
})

const registerSchema = credentialsSchema.extend({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^\w+$/)
})

const googleSchema = z.object({ idToken: z.string().min(1) })

const successResponse = z.object({ success: z.literal(true), data: UserModel })
const errorResponse = z.object({ success: z.literal(false), message: z.string() })

export class AuthController implements Routes {
  public controller = new OpenAPIHono()
  private readonly authService = new AuthService()

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/auth/google',
        tags: ['Authentication'],
        summary: 'Sign in with Google',
        request: { body: { content: { 'application/json': { schema: googleSchema } } } },
        responses: {
          200: {
            description: 'User signed in with Google',
            content: { 'application/json': { schema: successResponse } }
          },
          400: { description: 'Invalid Google request', content: { 'application/json': { schema: errorResponse } } },
          401: {
            description: 'Invalid Google identity token',
            content: { 'application/json': { schema: errorResponse } }
          },
          500: { description: 'Google sign-in failed', content: { 'application/json': { schema: errorResponse } } }
        }
      }),
      async (ctx) => {
        const body = ctx.req.valid('json')
        const session = await this.authService.loginWithGoogle(body.idToken)
        setCookie(ctx, SESSION_COOKIE, session.token, getSessionCookieOptions(ctx.req.url))
        ctx.header('X-Session-Token', session.token)
        return ctx.json({ success: true as const, data: session.user }, 200)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/auth/register',
        tags: ['Authentication'],
        summary: 'Register a user',
        request: { body: { content: { 'application/json': { schema: registerSchema } } } },
        responses: {
          201: { description: 'User registered', content: { 'application/json': { schema: successResponse } } },
          400: { description: 'Invalid registration data', content: { 'application/json': { schema: errorResponse } } },
          409: {
            description: 'Username or email is already registered',
            content: { 'application/json': { schema: errorResponse } }
          },
          500: { description: 'Registration failed', content: { 'application/json': { schema: errorResponse } } }
        }
      }),
      async (ctx) => {
        const body = ctx.req.valid('json')
        const session = await this.authService.register(body.username, body.email, body.password)
        setCookie(ctx, SESSION_COOKIE, session.token, getSessionCookieOptions(ctx.req.url))
        ctx.header('X-Session-Token', session.token)
        return ctx.json({ success: true as const, data: session.user }, 201)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/auth/login',
        tags: ['Authentication'],
        summary: 'Log in a user',
        request: { body: { content: { 'application/json': { schema: credentialsSchema } } } },
        responses: {
          200: { description: 'User logged in', content: { 'application/json': { schema: successResponse } } },
          400: { description: 'Invalid login data', content: { 'application/json': { schema: errorResponse } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: errorResponse } } },
          500: { description: 'Login failed', content: { 'application/json': { schema: errorResponse } } }
        }
      }),
      async (ctx) => {
        const body = ctx.req.valid('json')
        const session = await this.authService.login(body.email, body.password)
        setCookie(ctx, SESSION_COOKIE, session.token, getSessionCookieOptions(ctx.req.url))
        ctx.header('X-Session-Token', session.token)
        return ctx.json({ success: true as const, data: session.user }, 200)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/auth/logout',
        tags: ['Authentication'],
        summary: 'Log out the current user',
        responses: {
          200: {
            description: 'User logged out',
            content: { 'application/json': { schema: z.object({ success: z.literal(true), message: z.string() }) } }
          },
          500: { description: 'Logout failed', content: { 'application/json': { schema: errorResponse } } }
        }
      }),
      async (ctx) => {
        const token = getRequestSessionToken(ctx)
        await this.authService.logout(token)
        deleteCookie(ctx, SESSION_COOKIE, { path: '/' })
        return ctx.json({ success: true as const, message: 'Logged out successfully' }, 200)
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/auth/profile',
        tags: ['Authentication'],
        summary: 'Get the current user profile',
        responses: {
          200: { description: 'Current user profile', content: { 'application/json': { schema: successResponse } } },
          400: { description: 'Invalid session', content: { 'application/json': { schema: errorResponse } } },
          401: { description: 'Authentication required', content: { 'application/json': { schema: errorResponse } } },
          500: { description: 'Profile lookup failed', content: { 'application/json': { schema: errorResponse } } }
        }
      }),
      async (ctx) => {
        const token = getRequestSessionToken(ctx)
        const user = await this.authService.getUserBySession(token)
        if (token) {
          setCookie(ctx, SESSION_COOKIE, token, getSessionCookieOptions(ctx.req.url))
          ctx.header('X-Session-Token', token)
        }
        return ctx.json({ success: true as const, data: user }, 200)
      }
    )
  }
}
