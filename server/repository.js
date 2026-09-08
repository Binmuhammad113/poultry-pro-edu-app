import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { cloneInitialFarmState } from '../src/domain/farm.js'

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), 'data')
const usersFile = resolve(dataDir, 'users.json')

function mapUser(row) {
  if (!row) return null
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, farm: row.farm }
}

export async function createRepository() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined })
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        farm JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      )
    `)
    return {
      mode: 'postgres',
      async healthCheck() { await pool.query('SELECT 1'); return true },
      async findById(id) { return mapUser((await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0]) },
      async findByEmail(email) { return mapUser((await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0]) },
      async create(user) {
        const result = await pool.query('INSERT INTO users (id, name, email, password_hash, farm) VALUES ($1, $2, $3, $4, $5) RETURNING *', [user.id, user.name, user.email, user.passwordHash, user.farm])
        return mapUser(result.rows[0])
      },
      async update(user) {
        const result = await pool.query('UPDATE users SET name = $2, email = $3, password_hash = $4, farm = $5, updated_at = NOW() WHERE id = $1 RETURNING *', [user.id, user.name, user.email, user.passwordHash, user.farm])
        return mapUser(result.rows[0])
      },
      async createSession(token, userId, expiresAt) {
        await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt])
      },
      async findSession(token) {
        const result = await pool.query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()', [token])
        return result.rows[0]?.user_id || null
      },
      async deleteSession(token) {
        await pool.query('DELETE FROM sessions WHERE token = $1', [token])
      },
      async createPasswordReset(token, userId, expiresAt) {
        await pool.query('DELETE FROM password_resets WHERE user_id = $1 OR expires_at <= NOW()', [userId])
        await pool.query('INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt])
      },
      async consumePasswordReset(token) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await client.query('SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL FOR UPDATE', [token])
          const userId = result.rows[0]?.user_id || null
          if (userId) await client.query('UPDATE password_resets SET used_at = NOW() WHERE token = $1', [token])
          await client.query('COMMIT')
          return userId
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
      async deleteUserSessions(userId) {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
      },
    }
  }

  await mkdir(dataDir, { recursive: true })
  return {
    mode: 'file',
    async healthCheck() { await this.readUsers(); return true },
    async readUsers() {
      try { return JSON.parse(await readFile(usersFile, 'utf8')) } catch { return [] }
    },
    async writeUsers(users) { await writeFile(usersFile, JSON.stringify(users, null, 2)) },
    async findById(id) { return (await this.readUsers()).find((user) => user.id === id) || null },
    async findByEmail(email) { return (await this.readUsers()).find((user) => user.email === email) || null },
    async create(user) { const users = await this.readUsers(); users.push(user); await this.writeUsers(users); return user },
    async update(user) { await this.writeUsers((await this.readUsers()).map((entry) => entry.id === user.id ? user : entry)); return user },
    async createSession(token, userId, expiresAt) {
      const users = await this.readUsers()
      const user = users.find((entry) => entry.id === userId)
      if (!user) throw new Error('User not found')
      user.sessions = Array.isArray(user.sessions) ? user.sessions : []
      user.sessions.push({ token, expiresAt })
      await this.writeUsers(users)
    },
    async findSession(token) {
      const users = await this.readUsers()
      const now = Date.now()
      const user = users.find((entry) => entry.sessions?.some((session) => session.token === token && new Date(session.expiresAt).getTime() > now))
      return user?.id || null
    },
    async deleteSession(token) {
      const users = await this.readUsers()
      await this.writeUsers(users.map((user) => ({ ...user, sessions: user.sessions?.filter((session) => session.token !== token) || [] })))
    },
    async createPasswordReset(token, userId, expiresAt) {
      const users = await this.readUsers()
      const user = users.find((entry) => entry.id === userId)
      if (!user) return
      user.passwordResets = [{ token, expiresAt }]
      await this.writeUsers(users)
    },
    async consumePasswordReset(token) {
      const users = await this.readUsers()
      const now = Date.now()
      let userId = null
      for (const user of users) {
        const reset = user.passwordResets?.find((entry) => entry.token === token && new Date(entry.expiresAt).getTime() > now && !entry.usedAt)
        if (reset) {
          reset.usedAt = new Date().toISOString()
          userId = user.id
          break
        }
      }
      await this.writeUsers(users)
      return userId
    },
    async deleteUserSessions(userId) {
      const users = await this.readUsers()
      await this.writeUsers(users.map((user) => user.id === userId ? { ...user, sessions: [] } : user))
    },
  }
}

export function newFarmForUser(name) {
  const base = cloneInitialFarmState()
  return { ...base, farm: { ...base.farm, manager: name } }
}
