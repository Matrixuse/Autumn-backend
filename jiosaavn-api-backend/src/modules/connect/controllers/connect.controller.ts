import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import type { Context } from 'hono'
import { getDatabase, getMongoClient } from '#common/database'
import type { Routes } from '#common/types'
import { AuthService } from '#modules/auth/services'

const SESSION_COOKIE = 'jiosaavn_session'
const getRequestSessionToken = (ctx: Context) => {
  const headerValue = ctx.req.header('Authorization')
  if (headerValue?.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim()
  return getCookie(ctx, SESSION_COOKIE)
}
const deviceIdModel = z.string().min(8).max(128)
const deviceNameModel = z.string().trim().min(1).max(48)
const trackModel = z.object({
  id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(128)),
  title: z.string().max(250).optional(),
  name: z.string().max(250).optional(),
  artist: z.string().max(250).optional(),
  subtitle: z.string().max(500).optional(),
  image: z.string().max(2048).nullable().optional(),
  album: z.string().max(250).optional(),
  duration: z.union([z.number(), z.string()]).optional(),
  language: z.string().max(64).optional(),
  queueSource: z.string().max(32).optional()
})
const snapshotModel = z.object({
  sessionId: z.string().min(1).max(128),
  revision: z.number().int().nonnegative(),
  track: trackModel.nullable(),
  positionMs: z.number().int().min(0).max(86_400_000),
  isPlaying: z.boolean(),
  queue: z.array(trackModel).max(100),
  currentIndex: z.number().int().min(-1).max(99),
  shuffle: z.boolean(),
  repeat: z.union([z.boolean(), z.string()]),
  autoplay: z.boolean()
})
const handoffIdModel = z.string().uuid()

type Device = {
  userId: ObjectId
  deviceId: string
  name: string
  platform: 'web' | 'android' | 'other'
  createdAt: Date
  lastSeenAt: Date
  lastActiveAt: Date
  enabled: boolean
  allowReceiving: boolean
  revokedAt?: Date
}
type Snapshot = z.infer<typeof snapshotModel>
type HandoffState = 'PENDING' | 'ACCEPTED' | 'TARGET_READY' | 'COMMITTED' | 'STARTED' | 'CANCELLED' | 'FAILED' | 'EXPIRED'
type Handoff = {
  _id: string
  userId: ObjectId
  sourceDeviceId: string
  targetDeviceId: string
  baseRevision: number
  state: HandoffState
  snapshot: Snapshot
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  error?: string
  ownerRestored?: boolean
}

export const getConnectDeviceStatus = (date: Date, now = Date.now()) => {
  const age = now - date.getTime()
  return age < 75_000 ? 'online' : age < 86_400_000 ? 'recently-active' : 'offline'
}

export const HANDOFF_TRANSITIONS: Record<string, HandoffState[]> = {
  accept: ['PENDING'],
  decline: ['PENDING', 'ACCEPTED', 'TARGET_READY'],
  ready: ['ACCEPTED'],
  'source-paused': ['TARGET_READY'],
  started: ['COMMITTED'],
  failed: ['PENDING', 'ACCEPTED', 'TARGET_READY', 'COMMITTED']
}

export const isAllowedHandoffTransition = (action: string, state: HandoffState) => HANDOFF_TRANSITIONS[action]?.includes(state) || false

const presentDevice = (device: Device, currentDeviceId: string, playbackOwnerId?: string) => {
  const status = getConnectDeviceStatus(device.lastSeenAt)
  return {
    deviceId: device.deviceId,
    name: device.name,
    platform: device.platform,
    createdAt: device.createdAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
    lastActiveAt: device.lastActiveAt.toISOString(),
    enabled: device.enabled,
    allowReceiving: device.allowReceiving,
    status,
    isCurrent: device.deviceId === currentDeviceId,
    isPlaybackOwner: device.deviceId === playbackOwnerId,
    available: device.deviceId !== currentDeviceId && status === 'online' && device.enabled && device.allowReceiving
  }
}

export class ConnectController implements Routes {
  public controller = new OpenAPIHono()
  private readonly authService: Pick<AuthService, 'getUserBySession'>

  constructor(authService: Pick<AuthService, 'getUserBySession'> = new AuthService()) {
    this.authService = authService
  }

  public initRoutes() {
    this.controller.post('/connect/devices/register', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const input = z.object({ deviceId: deviceIdModel, name: deviceNameModel, platform: z.enum(['web', 'android', 'other']) }).safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid device registration' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const devices = database.collection<Device>('connect_devices')
      const existing = await devices.findOne({ userId, deviceId: input.data.deviceId })
      if (existing?.revokedAt) return ctx.json({ success: false, message: 'This device registration was revoked' }, 403)
      const now = new Date()
      await devices.updateOne(
        { userId, deviceId: input.data.deviceId },
        { $set: { platform: input.data.platform, lastSeenAt: now, lastActiveAt: now }, $setOnInsert: { name: input.data.name, createdAt: now, enabled: true, allowReceiving: true } },
        { upsert: true }
      )
      const device = await devices.findOne({ userId, deviceId: input.data.deviceId })
      return ctx.json({ success: true, data: presentDevice(device!, input.data.deviceId) })
    })

    this.controller.get('/connect/devices', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const currentDeviceId = ctx.req.query('deviceId') || ''
      if (!deviceIdModel.safeParse(currentDeviceId).success) return ctx.json({ success: false, message: 'Invalid device ID' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const [devices, session] = await Promise.all([
        database.collection<Device>('connect_devices').find({ userId, revokedAt: { $exists: false } }).sort({ lastSeenAt: -1 }).toArray(),
        database.collection<{ ownerDeviceId: string }>('connect_sessions').findOne({ userId })
      ])
      return ctx.json({ success: true, data: { devices: devices.map((device) => presentDevice(device, currentDeviceId, session?.ownerDeviceId)), refreshedAt: new Date().toISOString() } })
    })

    this.controller.post('/connect/devices/heartbeat', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const input = z.object({ deviceId: deviceIdModel }).safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid heartbeat' }, 400)
      const now = new Date()
      const result = await (await getDatabase()).collection<Device>('connect_devices').updateOne(
        { userId: new ObjectId(user.id), deviceId: input.data.deviceId, revokedAt: { $exists: false } },
        { $set: { lastSeenAt: now, lastActiveAt: now } }
      )
      if (!result.matchedCount) return ctx.json({ success: false, message: 'Device is not registered or was revoked' }, 404)
      return ctx.json({ success: true, data: { lastSeenAt: now.toISOString() } })
    })

    this.controller.patch('/connect/devices/:deviceId', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const deviceId = deviceIdModel.safeParse(ctx.req.param('deviceId'))
      const body = await ctx.req.json().catch(() => null) as unknown
      if (!deviceId.success || !body || typeof body !== 'object') return ctx.json({ success: false, message: 'Invalid device update' }, 400)
      const input = z.object({ name: deviceNameModel.optional(), enabled: z.boolean().optional(), allowReceiving: z.boolean().optional() }).strict().safeParse(body)
      if (!input.success || !Object.keys(input.data).length) return ctx.json({ success: false, message: 'Invalid device update' }, 400)
      const result = await (await getDatabase()).collection<Device>('connect_devices').updateOne(
        { userId: new ObjectId(user.id), deviceId: deviceId.data, revokedAt: { $exists: false } }, { $set: input.data }
      )
      if (!result.matchedCount) return ctx.json({ success: false, message: 'Device not found' }, 404)
      if (input.data.enabled === false || input.data.allowReceiving === false) {
        await (await getDatabase()).collection<Handoff>('connect_handoffs').updateMany(
          { userId: new ObjectId(user.id), $or: [{ sourceDeviceId: deviceId.data }, { targetDeviceId: deviceId.data }], state: { $in: ['PENDING', 'ACCEPTED', 'TARGET_READY'] } },
          { $set: { state: 'CANCELLED', updatedAt: new Date(), error: 'Device availability was disabled', ownerRestored: true } }
        )
      }
      const device = await (await getDatabase()).collection<Device>('connect_devices').findOne({ userId: new ObjectId(user.id), deviceId: deviceId.data })
      return ctx.json({ success: true, data: presentDevice(device!, deviceId.data) })
    })

    this.controller.delete('/connect/devices/:deviceId', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const deviceId = deviceIdModel.safeParse(ctx.req.param('deviceId'))
      if (!deviceId.success) return ctx.json({ success: false, message: 'Invalid device ID' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const currentOwner = await database.collection('connect_sessions').findOne({ userId, ownerDeviceId: deviceId.data })
      if (currentOwner) return ctx.json({ success: false, message: 'Move playback before removing its current owner device' }, 409)
      const now = new Date()
      const result = await database.collection<Device>('connect_devices').updateOne(
        { userId, deviceId: deviceId.data, revokedAt: { $exists: false } },
        { $set: { revokedAt: now, enabled: false, allowReceiving: false } }
      )
      if (!result.matchedCount) return ctx.json({ success: false, message: 'Device not found' }, 404)
      await database.collection<Handoff>('connect_handoffs').updateMany(
        { userId, $or: [{ sourceDeviceId: deviceId.data }, { targetDeviceId: deviceId.data }], state: { $in: ['PENDING', 'ACCEPTED', 'TARGET_READY'] } },
        { $set: { state: 'CANCELLED', updatedAt: now, error: 'Device registration revoked', ownerRestored: true } }
      )
      return ctx.json({ success: true, data: { deviceId: deviceId.data, revoked: true } })
    })

    this.controller.put('/connect/session', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const input = z.object({ deviceId: deviceIdModel, snapshot: snapshotModel }).safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid playback snapshot' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const device = await database.collection<Device>('connect_devices').findOne({ userId, deviceId: input.data.deviceId, revokedAt: { $exists: false }, enabled: true })
      if (!device) return ctx.json({ success: false, message: 'This device is unavailable for playback sync' }, 403)
      const sessions = database.collection<{ userId: ObjectId; ownerDeviceId: string; revision: number }>('connect_sessions')
      const current = await sessions.findOne({ userId })
      if (current && current.ownerDeviceId !== input.data.deviceId) return ctx.json({ success: false, message: 'Playback is owned by another device' }, 409)
      const revision = (current?.revision ?? -1) + 1
      const result = await sessions.updateOne(
        current ? { userId, ownerDeviceId: input.data.deviceId, revision: current.revision } : { userId },
        { $set: { ownerDeviceId: input.data.deviceId, sessionId: input.data.snapshot.sessionId, revision, snapshot: { ...input.data.snapshot, revision }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: !current }
      )
      if (!result.matchedCount && !result.upsertedCount) return ctx.json({ success: false, message: 'Playback changed on another device' }, 409)
      return ctx.json({ success: true, data: { ownerDeviceId: input.data.deviceId, revision } })
    })

    this.controller.post('/connect/handoffs', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const input = z.object({ sourceDeviceId: deviceIdModel, targetDeviceId: deviceIdModel }).safeParse(await ctx.req.json().catch(() => null))
      if (!input.success) return ctx.json({ success: false, message: 'Invalid handoff request' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const [source, target, session] = await Promise.all([
        database.collection<Device>('connect_devices').findOne({ userId, deviceId: input.data.sourceDeviceId, revokedAt: { $exists: false }, enabled: true }),
        database.collection<Device>('connect_devices').findOne({ userId, deviceId: input.data.targetDeviceId, revokedAt: { $exists: false }, enabled: true, allowReceiving: true }),
        database.collection<{ ownerDeviceId: string; revision: number; snapshot: Snapshot }>('connect_sessions').findOne({ userId })
      ])
      if (source?.deviceId === target?.deviceId) return ctx.json({ success: false, message: 'Choose another device' }, 400)
      if (!source || !target || getConnectDeviceStatus(target.lastSeenAt) !== 'online') return ctx.json({ success: false, message: 'Target device is not eligible to receive playback' }, 409)
      if (!session || session.ownerDeviceId !== source.deviceId || !session.snapshot.track) return ctx.json({ success: false, message: 'There is no transferable playback session on this device' }, 409)
      const handoffs = database.collection<Handoff>('connect_handoffs')
      const existing = await handoffs.findOne({ userId, sourceDeviceId: source.deviceId, targetDeviceId: target.deviceId, state: { $in: ['PENDING', 'ACCEPTED', 'TARGET_READY', 'COMMITTED'] }, expiresAt: { $gt: new Date() } })
      if (existing) return ctx.json({ success: true, data: existing })
      const now = new Date()
        const handoff: Handoff = { _id: randomUUID(), userId, sourceDeviceId: source.deviceId, targetDeviceId: target.deviceId, baseRevision: session.revision, state: 'PENDING', snapshot: session.snapshot, createdAt: now, updatedAt: now, expiresAt: new Date(now.getTime() + 90_000) }
      await handoffs.insertOne(handoff)
      return ctx.json({ success: true, data: handoff }, 201)
    })

    this.controller.get('/connect/handoffs/pending', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const deviceId = deviceIdModel.safeParse(ctx.req.query('deviceId'))
      if (!deviceId.success) return ctx.json({ success: false, message: 'Invalid device ID' }, 400)
      const userId = new ObjectId(user.id)
      const device = await (await getDatabase()).collection<Device>('connect_devices').findOne({ userId, deviceId: deviceId.data, revokedAt: { $exists: false }, enabled: true, allowReceiving: true })
      if (!device) return ctx.json({ success: false, message: 'Device is unavailable' }, 403)
      const pending = await (await getDatabase()).collection<Handoff>('connect_handoffs').findOne({ userId, targetDeviceId: deviceId.data, state: { $in: ['PENDING', 'ACCEPTED', 'TARGET_READY', 'COMMITTED'] }, expiresAt: { $gt: new Date() } }, { sort: { createdAt: 1 } })
      return ctx.json({ success: true, data: pending || null })
    })

    this.controller.get('/connect/handoffs/active', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const deviceId = deviceIdModel.safeParse(ctx.req.query('deviceId'))
      if (!deviceId.success) return ctx.json({ success: false, message: 'Invalid device ID' }, 400)
      const active = await (await getDatabase()).collection<Handoff>('connect_handoffs').findOne({
        userId: new ObjectId(user.id),
        sourceDeviceId: deviceId.data,
        state: { $in: ['PENDING', 'ACCEPTED', 'TARGET_READY', 'COMMITTED'] },
        expiresAt: { $gt: new Date() }
      }, { sort: { createdAt: -1 } })
      return ctx.json({ success: true, data: active || null })
    })

    this.controller.get('/connect/handoffs/:handoffId', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const handoffId = handoffIdModel.safeParse(ctx.req.param('handoffId'))
      const deviceId = deviceIdModel.safeParse(ctx.req.query('deviceId'))
      if (!handoffId.success || !deviceId.success) return ctx.json({ success: false, message: 'Invalid handoff lookup' }, 400)
      const handoffs = (await getDatabase()).collection<Handoff>('connect_handoffs')
      const request = await handoffs.findOne({ _id: handoffId.data, userId: new ObjectId(user.id), $or: [{ sourceDeviceId: deviceId.data }, { targetDeviceId: deviceId.data }] })
      if (!request) return ctx.json({ success: false, message: 'Handoff not found' }, 404)
      if (request.expiresAt <= new Date() && !['STARTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(request.state)) {
        const database = await getDatabase()
        const transaction = (await getMongoClient()).startSession()
        let ownerRestored = false
        try {
          await transaction.withTransaction(async () => {
            const playback = await database.collection<{ ownerDeviceId: string; revision: number }>('connect_sessions').findOne({ userId: request.userId }, { session: transaction })
            if (request.state === 'COMMITTED' && playback?.ownerDeviceId === request.targetDeviceId && playback.revision === request.baseRevision + 1) {
              const rollback = await database.collection('connect_sessions').updateOne(
                { userId: request.userId, ownerDeviceId: request.targetDeviceId, revision: request.baseRevision + 1 },
                { $set: { ownerDeviceId: request.sourceDeviceId, revision: request.baseRevision + 2, snapshot: { ...request.snapshot, revision: request.baseRevision + 2 }, updatedAt: new Date() } },
                { session: transaction }
              )
              ownerRestored = rollback.matchedCount > 0
            } else ownerRestored = playback?.ownerDeviceId === request.sourceDeviceId
            const expired = await handoffs.updateOne(
              { _id: request._id, state: request.state, expiresAt: { $lte: new Date() } },
              { $set: { state: 'EXPIRED', updatedAt: new Date(), error: 'The request expired', ownerRestored } },
              { session: transaction }
            )
            if (!expired.matchedCount) throw new Error('Handoff changed while it was expiring')
          })
        } finally {
          await transaction.endSession()
        }
        request.state = 'EXPIRED'
        request.ownerRestored = ownerRestored
      }
      return ctx.json({ success: true, data: request })
    })

    this.controller.post('/connect/handoffs/:handoffId/action', async (ctx) => {
      const token = getRequestSessionToken(ctx)
      const user = await this.authService.getUserBySession(token)
      const handoffId = handoffIdModel.safeParse(ctx.req.param('handoffId'))
      const input = z.object({ deviceId: deviceIdModel, action: z.enum(['accept', 'decline', 'ready', 'source-paused', 'started', 'failed']), snapshot: snapshotModel.optional() }).safeParse(await ctx.req.json().catch(() => null))
      if (!handoffId.success || !input.success) return ctx.json({ success: false, message: 'Invalid handoff action' }, 400)
      const database = await getDatabase()
      const userId = new ObjectId(user.id)
      const handoffs = database.collection<Handoff>('connect_handoffs')
      const request = await handoffs.findOne({ _id: handoffId.data, userId })
      if (!request) return ctx.json({ success: false, message: 'Handoff not found' }, 404)
      const { deviceId, action, snapshot } = input.data
      const isSource = request.sourceDeviceId === deviceId
      const isTarget = request.targetDeviceId === deviceId
      if (!isSource && !isTarget) return ctx.json({ success: false, message: 'This device is not part of the handoff' }, 403)
      if (action === 'source-paused' && isSource && request.state === 'COMMITTED') return ctx.json({ success: true, data: request })
      const registered = await database.collection<Device>('connect_devices').findOne({ userId, deviceId, revokedAt: { $exists: false }, enabled: true, ...(isTarget ? { allowReceiving: true } : {}) })
      if (!registered) return ctx.json({ success: false, message: 'Device is unavailable' }, 403)
      if (!isAllowedHandoffTransition(action, request.state)) return ctx.json({ success: false, message: `Cannot ${action} a handoff in ${request.state}` }, 409)
      if ((['accept', 'decline', 'ready', 'started'] as string[]).includes(action) && !isTarget) return ctx.json({ success: false, message: 'Only the target can perform this action' }, 403)
      if (action === 'source-paused' && !isSource) return ctx.json({ success: false, message: 'Only the source can acknowledge pausing' }, 403)
      if (action === 'failed' && !isTarget) return ctx.json({ success: false, message: 'Only the target can report a playback failure' }, 403)
      if (action === 'source-paused') {
        if (!snapshot) return ctx.json({ success: false, message: 'A final playback snapshot is required' }, 400)
        const client = await getMongoClient()
        const transaction = client.startSession()
        let committed: Handoff | null = null
        try {
          await transaction.withTransaction(async () => {
            const current = await handoffs.findOne({ _id: request._id, userId, state: 'TARGET_READY', expiresAt: { $gt: new Date() } }, { session: transaction })
            if (!current) throw new Error('Handoff expired or changed')
            const revision = current.baseRevision + 1
            const sessionResult = await database.collection('connect_sessions').updateOne(
              { userId, ownerDeviceId: current.sourceDeviceId, revision: current.baseRevision },
              { $set: { ownerDeviceId: current.targetDeviceId, sessionId: snapshot.sessionId, snapshot: { ...snapshot, revision }, revision, updatedAt: new Date() } },
              { session: transaction }
            )
            if (!sessionResult.matchedCount) throw new Error('Playback ownership changed; refresh and try again')
            committed = await handoffs.findOneAndUpdate(
              { _id: current._id, userId, state: 'TARGET_READY' },
              { $set: { state: 'COMMITTED', snapshot, updatedAt: new Date() } },
              { session: transaction, returnDocument: 'after' }
            )
            if (!committed) throw new Error('Handoff changed before commit')
          })
        } catch (error) {
          return ctx.json({ success: false, message: error instanceof Error ? error.message : 'Could not commit playback transfer' }, 409)
        } finally {
          await transaction.endSession()
        }
        return ctx.json({ success: true, data: committed })
      }
      const nextState: Partial<Record<typeof action, HandoffState>> = { accept: 'ACCEPTED', decline: 'CANCELLED', ready: 'TARGET_READY', started: 'STARTED', failed: 'FAILED' }
      if (action === 'failed' && request.state === 'COMMITTED') {
        const transaction = (await getMongoClient()).startSession()
        let failed: Handoff | null = null
        let ownerRestored = false
        try {
          await transaction.withTransaction(async () => {
            const rollback = await database.collection('connect_sessions').updateOne(
              { userId, ownerDeviceId: request.targetDeviceId, revision: request.baseRevision + 1 },
              { $set: { ownerDeviceId: request.sourceDeviceId, revision: request.baseRevision + 2, snapshot: { ...request.snapshot, revision: request.baseRevision + 2 }, updatedAt: new Date() } },
              { session: transaction }
            )
            ownerRestored = rollback.matchedCount > 0
            failed = await handoffs.findOneAndUpdate(
              { _id: request._id, userId, state: 'COMMITTED' },
              { $set: { state: 'FAILED', updatedAt: new Date(), error: 'The target could not start playback', ownerRestored } },
              { session: transaction, returnDocument: 'after' }
            )
            if (!failed) throw new Error('Handoff changed before rollback')
          })
        } catch (error) {
          return ctx.json({ success: false, message: error instanceof Error ? error.message : 'Could not restore playback ownership' }, 409)
        } finally {
          await transaction.endSession()
        }
        return ctx.json({ success: true, data: failed })
      }
      const updated = await handoffs.findOneAndUpdate(
        { _id: request._id, userId, state: request.state, expiresAt: { $gt: new Date() } },
          { $set: { state: nextState[action], updatedAt: new Date(), ...(action === 'failed' || action === 'decline' ? { error: action === 'failed' ? 'The target could not prepare playback' : 'The request was declined', ownerRestored: true } : {}) } },
        { returnDocument: 'after' }
      )
      if (!updated) return ctx.json({ success: false, message: 'Handoff expired or changed' }, 409)
      return ctx.json({ success: true, data: updated })
    })
  }
}