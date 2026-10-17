import test from 'node:test'
import assert from 'node:assert/strict'
import { getDataSavingAudioUrl } from './mediaQuality.js'

test('data saving selects the lowest known bitrate variant', () => {
  const variants = [
    { quality: '320kbps', url: 'https://audio.example/high.mp3' },
    { bitrate: 96, url: 'https://audio.example/low.mp3' },
    { kbps: '160', url: 'https://audio.example/medium.mp3' }
  ]

  assert.equal(getDataSavingAudioUrl(variants), 'https://audio.example/low.mp3')
})

test('data saving falls back safely when no bitrate metadata exists', () => {
  assert.equal(getDataSavingAudioUrl([{ url: 'https://audio.example/audio.mp3' }]), 'https://audio.example/audio.mp3')
  assert.equal(getDataSavingAudioUrl(null), null)
})