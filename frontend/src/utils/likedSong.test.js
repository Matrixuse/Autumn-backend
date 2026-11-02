import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeLikedSongMetadata, needsLikedSongMetadata, normalizeLikedSong, normalizeLikedSongs } from './likedSong.js'

test('liked songs normalize alternate catalog fields and image variants', () => {
  const song = normalizeLikedSong({
    id: 123,
    name: 'Sample track',
    artists: { primary: [{ name: 'Sample artist' }] },
    image: [{ quality: '150x150', url: 'https://images.example/small.jpg' }, { quality: '500x500', url: 'https://images.example/large.jpg' }],
    duration: '215'
  })

  assert.equal(song.id, '123')
  assert.equal(song.title, 'Sample track')
  assert.equal(song.artist, 'Sample artist')
  assert.equal(song.image, 'https://images.example/large.jpg')
  assert.equal(song.duration, 215)
})

test('liked songs turn nested display values into text instead of React objects', () => {
  const song = normalizeLikedSong({
    _id: 'track-1',
    title: { text: 'Nested title' },
    artist: { name: 'Nested artist' },
    image: { url: 'https://images.example/cover.jpg' }
  })

  assert.equal(song.title, 'Nested title')
  assert.equal(song.artist, 'Nested artist')
  assert.equal(song.image, 'https://images.example/cover.jpg')
})

test('liked songs use safe display fallbacks and discard entries without IDs', () => {
  assert.deepEqual(normalizeLikedSongs([
    { id: 'missing-metadata' },
    { title: 'No ID' },
    null
  ]), [{
    id: 'missing-metadata',
    title: 'Unknown Track',
    artist: 'Unknown Artist',
    image: null,
    duration: 0
  }])
})

test('liked songs fill only missing metadata from catalog details', () => {
  const incompleteSong = normalizeLikedSong({ id: 'track-2', title: 'Unknown Track' })
  const enriched = mergeLikedSongMetadata(incompleteSong, {
    id: 'track-2',
    name: 'Recovered title',
    subtitle: 'Recovered artist',
    image: [{ quality: '500x500', url: 'https://images.example/recovered.jpg' }, { quality: '150x150', url: 'https://images.example/small.jpg' }],
    duration: '180'
  })

  assert.equal(needsLikedSongMetadata(incompleteSong), true)
  assert.equal(enriched.title, 'Recovered title')
  assert.equal(enriched.artist, 'Recovered artist')
  assert.equal(enriched.image, 'https://images.example/recovered.jpg')
  assert.equal(enriched.duration, 180)
})

test('liked-song metadata lookup preserves existing fields', () => {
  const existing = normalizeLikedSong({ id: 'track-3', title: 'Existing title', artist: 'Existing artist' })
  const enriched = mergeLikedSongMetadata(existing, { name: 'Different title', subtitle: 'Different artist' })

  assert.equal(enriched.title, 'Existing title')
  assert.equal(enriched.artist, 'Existing artist')
})