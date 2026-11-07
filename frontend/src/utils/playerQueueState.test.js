import test from 'node:test'
import assert from 'node:assert/strict'
import { isRestorableQueueState, QUEUE_SCHEMA_VERSION } from './playerQueueState.js'

const currentQueue = {
  queueSchemaVersion: QUEUE_SCHEMA_VERSION,
  savedAt: 1_000,
  queue: [{ id: 'current' }, { id: 'next' }]
}

test('current queue schema restores valid queue state', () => {
  assert.equal(isRestorableQueueState(currentQueue, 2_000), true)
})

test('legacy section queues without the schema marker are discarded', () => {
  const legacyQueue = { ...currentQueue }
  delete legacyQueue.queueSchemaVersion
  assert.equal(isRestorableQueueState(legacyQueue, 2_000), false)
})

test('expired or malformed queue state is discarded', () => {
  assert.equal(isRestorableQueueState(currentQueue, currentQueue.savedAt + 8 * 24 * 60 * 60 * 1000), false)
  assert.equal(isRestorableQueueState({ ...currentQueue, queue: [{ title: 'No ID' }] }, 2_000), false)
})