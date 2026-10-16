import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { ObjectId } from 'mongodb'
import { getDatabase } from '#common/database'
import type { User } from '#modules/auth/models'

interface UserDocument {
  _id: ObjectId
  username: string
  email: string
  passwordHash: string
  googleId?: string
  avatar?: string
  image?: string
  createdAt: Date
}

interface SessionDocument {
  _id: ObjectId
  tokenHash: string
  userId: ObjectId
  expiresAt: Date
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 409 | 500
  ) {
    super(message)
  }
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 365 * 10
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || '36232842622-0cfa2jhn3fv20iq16ro2c05uhhrj9td0.apps.googleusercontent.com'
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

const getGoogleAvatar = (picture: unknown) => {
  if (typeof picture !== 'string' || !picture.trim()) return undefined

  try {
    const url = new URL(picture)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const toUser = (user: UserDocument): User => ({
  id: user._id.toHexString(),
  username: user.username,
  email: user.email,
  avatar: user.avatar || user.image || undefined,
  createdAt: user.createdAt.toISOString()
})

export class AuthService {
  async register(username: string, email: string, password: string) {
    const database = await getDatabase()
    const user: UserDocument = {
      _id: new ObjectId(),
      username: username.trim(),
      email: normalizeEmail(email),
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date()
    }

    try {
      await database.collection<UserDocument>('users').insertOne(user)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new AuthError('Username or email is already registered', 409)
      }
      throw error
    }

    return this.createSession(user)
  }

  async login(email: string, password: string) {
    const database = await getDatabase()
    const user = await database.collection<UserDocument>('users').findOne({ email: normalizeEmail(email) })

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthError('Invalid email or password', 401)
    }

    return this.createSession(user)
  }

  async loginWithGoogle(idToken: string) {
    let payload
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
      payload = ticket.getPayload()
    } catch {
      throw new AuthError('Invalid Google identity token', 401)
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AuthError('Google account email is not verified', 401)
    }
    const googleAvatar = getGoogleAvatar(payload.picture)

    const database = await getDatabase()
    const users = database.collection<UserDocument>('users')
    let user = await users.findOne({ googleId: payload.sub })

    if (!user) {
      user = await users.findOne({ email: normalizeEmail(payload.email) })
    }

    if (user) {
      const updates: { googleId: string; avatar?: string } = { googleId: payload.sub }
      if (!user.avatar && !user.image && googleAvatar) updates.avatar = googleAvatar
      await users.updateOne({ _id: user._id }, { $set: updates })
      user.googleId = payload.sub
      if (updates.avatar) user.avatar = updates.avatar
    } else {
      const baseUsername =
        (payload.name || payload.email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'autumn_user'
      const username = await this.getAvailableUsername(baseUsername)
      user = {
        _id: new ObjectId(),
        username,
        email: normalizeEmail(payload.email),
        passwordHash: '',
        googleId: payload.sub,
        avatar: googleAvatar,
        createdAt: new Date()
      }
      await users.insertOne(user)
    }

    return this.createSession(user)
  }

  async getUserBySession(token: string | undefined) {
    if (!token) {
      throw new AuthError('Authentication required', 401)
    }

    const database = await getDatabase()
    const session = await database.collection<SessionDocument>('sessions').findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() }
    })

    if (!session) {
      throw new AuthError('Authentication required', 401)
    }

    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
    await database.collection<SessionDocument>('sessions').updateOne({ _id: session._id }, { $set: { expiresAt } })

    const user = await database.collection<UserDocument>('users').findOne({ _id: session.userId })
    if (!user) {
      throw new AuthError('User not found', 401)
    }

    return toUser(user)
  }

  async logout(token: string | undefined) {
    if (!token) return

    const database = await getDatabase()
    await database.collection<SessionDocument>('sessions').deleteOne({ tokenHash: hashToken(token) })
  }

  private async createSession(user: UserDocument) {
    const database = await getDatabase()
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    await database.collection<SessionDocument>('sessions').insertOne({
      _id: new ObjectId(),
      tokenHash: hashToken(token),
      userId: user._id,
      expiresAt
    })

    return { token, user: toUser(user), expiresAt }
  }

  private async getAvailableUsername(baseUsername: string) {
    const database = await getDatabase()
    const users = database.collection<UserDocument>('users')
    let username = baseUsername
    let suffix = 1

    while (await users.findOne({ username })) {
      username = `${baseUsername.slice(0, 27)}_${suffix}`
      suffix += 1
    }

    return username
  }
}
