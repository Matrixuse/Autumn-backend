import {
  AlbumController,
  ArtistController,
  AuthController,
  RecommendationController,
  SearchController,
  SongController
} from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
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

export default app
