import {
  AlbumController,
  ArtistController,
  AuthController,
  ConnectController,
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
  new RecommendationController(),
  new ConnectController()
]).getApp()

export default app
