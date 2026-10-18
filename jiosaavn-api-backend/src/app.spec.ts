import { describe, expect, it } from 'vitest'
import { App } from './app.js'

describe('App CORS policy', () => {
  it('allows production Render origins and preserves credentials', async () => {
    const app = new App([]).getApp()

    const response = await app.request('https://example.com/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://autumn-its-listening.onrender.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    })

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://autumn-its-listening.onrender.com')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })
})
