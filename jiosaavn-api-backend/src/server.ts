import { AlbumController, ArtistController, AuthController, SearchController, SongController } from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
import { App } from './app.js'

const app = new App([
  new AuthController(),
  new SearchController(),
  new SongController(),
  new AlbumController(),
  new ArtistController(),
  new PlaylistController()
]).getApp()

export default app
