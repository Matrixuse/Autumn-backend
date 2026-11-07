export const QUEUE_SCHEMA_VERSION = 2
const MAX_STATE_AGE = 7 * 24 * 60 * 60 * 1000

export const isRestorableQueueState = (state, now = Date.now()) => Boolean(
  state
  && state.queueSchemaVersion === QUEUE_SCHEMA_VERSION
  && now - Number(state.savedAt || 0) <= MAX_STATE_AGE
  && Array.isArray(state.queue)
  && state.queue.every((song) => song?.id)
)