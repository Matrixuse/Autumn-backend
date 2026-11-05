import assert from 'node:assert/strict'
import test from 'node:test'
import { sortSongs } from './sortSongs.js'

const songs = [
  { id: '1', title: 'Zulu' },
  { id: '2', title: 'alpha' },
  { id: '3', title: 'Mango' },
]

test('ascending preserves the playlist order', () => {
  assert.deepEqual(sortSongs(songs).map((song) => song.id), ['1', '2', '3'])
})

test('descending reverses the playlist order', () => {
  assert.deepEqual(sortSongs(songs, 'descending').map((song) => song.id), ['3', '2', '1'])
})

test('title sorting is case-insensitive and does not mutate the source', () => {
  assert.deepEqual(sortSongs(songs, 'title').map((song) => song.id), ['2', '3', '1'])
  assert.deepEqual(songs.map((song) => song.id), ['1', '2', '3'])
})