import assert from 'node:assert/strict'
import test from 'node:test'
import { getPlaylistCoverModel } from './playlistCover.js'

const songs = ['a', 'b', 'c', 'd', 'e'].map((name) => ({
  id: name,
  image: `https://covers.test/${name}.jpg`,
}))

test('empty playlists use a custom or existing playlist cover before the fallback', () => {
  assert.deepEqual(getPlaylistCoverModel({ isLocal: true, image: 'https://covers.test/custom.jpg', songs: [] }), {
    layout: 'single', images: ['https://covers.test/custom.jpg'], source: 'custom',
  })
  assert.deepEqual(getPlaylistCoverModel({ image: [{ url: 'https://covers.test/provider.jpg' }], songs: [] }), {
    layout: 'single', images: ['https://covers.test/provider.jpg'], source: 'playlist',
  })
  assert.deepEqual(getPlaylistCoverModel({ songs: [] }), {
    layout: 'single', images: [null], source: 'empty',
  })
})

test('one, two, and three songs select their corresponding layouts', () => {
  assert.equal(getPlaylistCoverModel({}, songs.slice(0, 1)).layout, 'single')
  assert.deepEqual(getPlaylistCoverModel({}, songs.slice(0, 2)), {
    layout: 'two', images: songs.slice(0, 2).map((song) => song.image), source: 'songs',
  })
  assert.deepEqual(getPlaylistCoverModel({}, songs.slice(0, 3)), {
    layout: 'three', images: songs.slice(0, 3).map((song) => song.image), source: 'songs',
  })
})

test('four or more songs use only the first four in current order', () => {
  const firstFour = songs.slice(0, 4).map((song) => song.image)
  assert.deepEqual(getPlaylistCoverModel({}, songs), { layout: 'four', images: firstFour, source: 'songs' })
  assert.deepEqual(getPlaylistCoverModel({}, [...songs.slice(0, 4), { id: 'f', image: 'https://covers.test/f.jpg' }]).images, firstFour)
  assert.deepEqual(getPlaylistCoverModel({}, songs.slice(1)).images, songs.slice(1, 5).map((song) => song.image))
  const reordered = [songs[2], songs[0], songs[3], songs[1], songs[4]]
  assert.deepEqual(getPlaylistCoverModel({}, reordered).images, reordered.slice(0, 4).map((song) => song.image))
})

test('missing, malformed, and invalid song covers use per-tile fallbacks', () => {
  const model = getPlaylistCoverModel({}, [null, {}, { id: 'one', image: 'javascript:alert(1)' }, { id: 'two', raw: { image: [{ link: 'https://covers.test/two.jpg' }] } }])
  assert.equal(model.layout, 'two')
  assert.deepEqual(model.images, [null, 'https://covers.test/two.jpg'])
})

test('an explicit local custom cover takes precedence over song collage', () => {
  assert.deepEqual(getPlaylistCoverModel({ isLocal: true, image: 'https://covers.test/custom.jpg' }, songs), {
    layout: 'single', images: ['https://covers.test/custom.jpg'], source: 'custom',
  })
})