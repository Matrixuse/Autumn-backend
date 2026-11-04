import test from 'node:test'
import assert from 'node:assert/strict'
import { setItemWithCacheEviction } from './storage.js'

test('retries a storage write after evicting disposable home caches', () => {
  const values = new Map([
    ['autumn_home_old', 'cache'],
    ['autumn_library_old', 'cache'],
    ['autumn_quick_picks_old', 'cache'],
    ['autumn_listen_history', 'old history']
  ])
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = {
    get length() { return values.size },
    key(index) { return [...values.keys()][index] ?? null },
    setItem(key, value) {
      if (values.has('autumn_home_old')) throw new Error('quota exceeded')
      values.set(key, String(value))
    },
    removeItem(key) { values.delete(key) }
  }

  try {
    assert.equal(setItemWithCacheEviction('autumn_listen_history', 'new history'), true)
    assert.equal(values.has('autumn_home_old'), false)
    assert.equal(values.has('autumn_library_old'), false)
    assert.equal(values.has('autumn_quick_picks_old'), false)
    assert.equal(values.get('autumn_listen_history'), 'new history')
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})

test('returns false when storage remains unavailable after cache eviction', () => {
  const originalStorage = globalThis.localStorage
  globalThis.localStorage = {
    length: 0,
    key() { return null },
    setItem() { throw new Error('quota exceeded') },
    removeItem() {}
  }

  try {
    assert.equal(setItemWithCacheEviction('autumn_listen_history', 'history'), false)
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = originalStorage
  }
})