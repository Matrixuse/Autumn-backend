import {
  AccountDataController,
  AlbumController,
  ArtistController,
  AuthController,
  ConnectController,
  LikedSongController,
  RecommendationController,
  SearchController,
  SongController
} from '#modules/index'
import { PlaylistController } from '#modules/playlists/controllers'
import { App } from './app.js'

const app = new App([
  new AuthController(),
  new AccountDataController(),
  new SearchController(),
  new SongController(),
  new AlbumController(),
  new ArtistController(),
  new PlaylistController(),
  new LikedSongController(),
  new RecommendationController(),
  new ConnectController()
]).getApp()

export default app
