import test from 'node:test'
import assert from 'node:assert/strict'
import { getBestAudioUrl, getDataSavingAudioUrl, getSameQualityAlternateAudioUrl } from './mediaQuality.js'

test('playback selects the highest available bitrate', () => {
  const variants = [
    { bitrate: 96, url: 'https://audio.example/low.mp3' },
    { kbps: '160', url: 'https://audio.example/medium.mp3' },
    { quality: '320kbps', url: 'https://audio.example/high.mp3' }
  ]

  assert.equal(getBestAudioUrl(variants), 'https://audio.example/high.mp3')
})

test('playback reads bitrate from keyed variants, not digits in URLs', () => {
  const variants = {
    '96kbps': 'https://audio.example/320-low.mp3',
    '320kbps': 'https://audio.example/96-high.mp3'
  }

  assert.equal(getBestAudioUrl(variants), 'https://audio.example/96-high.mp3')
})

test('retry only selects an alternate at the current bitrate', () => {
  const variants = [
    { quality: '160kbps', url: 'https://audio.example/medium.mp3' },
    { quality: '320kbps', url: 'https://audio.example/high-1.mp3' },
    { quality: '320kbps', url: 'https://audio.example/high-2.mp3' }
  ]

  assert.equal(getSameQualityAlternateAudioUrl(variants, 'https://audio.example/high-1.mp3'), 'https://audio.example/high-2.mp3')
  assert.equal(getSameQualityAlternateAudioUrl(variants, 'https://audio.example/high-2.mp3'), 'https://audio.example/high-1.mp3')
})

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