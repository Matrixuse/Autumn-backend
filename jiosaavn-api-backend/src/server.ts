import { AlbumController, ArtistController, AuthController, RecommendationController, SearchController, SongController } from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
import process from 'node:process'
import { App } from './app.js'

const app = new App([
  new AuthController(),
  new SearchController(),
  new SongController(),
  new AlbumController(),
  new ArtistController(),
  new PlaylistController(),
  new RecommendationController()
]).getApp()

type WorkerBindings = {
  MONGO_URI?: string
  MONGO_DB_NAME?: string
  GOOGLE_CLIENT_ID?: string
  FRONTEND_URL?: string
}

export default {
  fetch(request: Request, bindings: WorkerBindings, executionContext?: Parameters<typeof app.fetch>[2]) {
    for (const key of ['MONGO_URI', 'MONGO_DB_NAME', 'GOOGLE_CLIENT_ID', 'FRONTEND_URL'] as const) {
      const value = bindings?.[key]
      if (typeof value === 'string') process.env[key] = value
    }

    return app.fetch(request, bindings, executionContext)
  }
}
