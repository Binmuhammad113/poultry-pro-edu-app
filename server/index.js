import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRepository, newFarmForUser } from './repository.js'

const port = Number(process.env.PORT || 8787)
const distDir = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const isProduction = process.env.NODE_ENV === 'production'
const allowedOrigin = process.env.CORS_ORIGIN || ''
const sessionMaxAge = 60 * 60 * 24 * 7
const passwordResetMaxAge = 30 * 60 * 1000
const appUrl = process.env.APP_URL || `http://localhost:${port}`
const authRateWindowMs = 15 * 60 * 1000
const authRateLimit = 10
const authAttempts = new Map()

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const derivedKey = scryptSync(password, salt, 64)
  return timingSafeEqual(derivedKey, Buffer.from(key, 'hex'))
}
const cookieValue = (request) => request.headers.cookie?.match(/poultrypro_session=([^;]+)/)?.[1]
const sessionCookie = (token, maxAge = sessionMaxAge) => `poultrypro_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`

const repository = await createRepository()

async function currentUser(request) {
  const token = cookieValue(request)
  if (!token) return null
  const userId = await repository.findSession(token)
  if (!userId) return null
  return repository.findById(userId)
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) body += chunk
  return body ? JSON.parse(body) : {}
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email }
}

async function sendPasswordResetEmail(email, token) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    if (isProduction) console.warn('Password reset email skipped: RESEND_API_KEY and EMAIL_FROM are required')
    return false
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: 'Reset your PoultryPro password',
      text: `Reset your PoultryPro password within 30 minutes: ${appUrl}/?reset=${token}`,
      html: `<p>Reset your PoultryPro password within 30 minutes.</p><p><a href="${appUrl}/?reset=${token}">Reset password</a></p>`,
    }),
  })
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`)
  return true
}

function requestIp(request) {
  return request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress || 'unknown'
}

function authRateKey(request, pathname) {
  return `${requestIp(request)}:${pathname}`
}

function checkAuthRateLimit(request, pathname) {
  const key = authRateKey(request, pathname)
  const now = Date.now()
  const attempts = (authAttempts.get(key) || []).filter((timestamp) => now - timestamp < authRateWindowMs)
  if (attempts.length >= authRateLimit) {
    const retryAfter = Math.ceil((authRateWindowMs - (now - attempts[0])) / 1000)
    return retryAfter
  }
  attempts.push(now)
  authAttempts.set(key, attempts)
  return 0
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})

  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname
    if (pathname === '/api/health' && request.method === 'GET') {
      try {
        await repository.healthCheck()
        return sendJson(response, 200, { ok: true, service: 'poultrypro-api', storage: repository.mode })
      } catch (error) {
        console.error('Health check failed', error)
        return sendJson(response, 503, { ok: false, service: 'poultrypro-api', error: 'Storage unavailable' })
      }
    }

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      const retryAfter = checkAuthRateLimit(request, pathname)
      if (retryAfter) return sendJson(response, 429, { error: 'Too many registration attempts. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      const { name, email, password } = await readBody(request)
      if (!name || !email || !password || password.length < 6) return sendJson(response, 400, { error: 'Name, email, and a 6-character password are required' })
      if (await repository.findByEmail(email.toLowerCase())) return sendJson(response, 409, { error: 'An account with this email already exists' })
      const user = await repository.create({ id: randomUUID(), name, email: email.toLowerCase(), passwordHash: hashPassword(password), farm: newFarmForUser(name) })
      const session = randomBytes(24).toString('hex')
      await repository.createSession(session, user.id, new Date(Date.now() + sessionMaxAge * 1000))
      return sendJson(response, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) })
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const retryAfter = checkAuthRateLimit(request, pathname)
      if (retryAfter) return sendJson(response, 429, { error: 'Too many sign-in attempts. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      const { email, password } = await readBody(request)
      const user = await repository.findByEmail(email?.toLowerCase())
      if (!user || !verifyPassword(password || '', user.passwordHash)) return sendJson(response, 401, { error: 'Incorrect email or password' })
      const session = randomBytes(24).toString('hex')
      await repository.createSession(session, user.id, new Date(Date.now() + sessionMaxAge * 1000))
      return sendJson(response, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) })
    }

    if (pathname === '/api/auth/request-password-reset' && request.method === 'POST') {
      const retryAfter = checkAuthRateLimit(request, pathname)
      if (retryAfter) return sendJson(response, 429, { error: 'Too many reset requests. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      const { email } = await readBody(request)
      const user = await repository.findByEmail(email?.toLowerCase())
      const payload = { message: 'If an account exists for that email, password reset instructions are ready.' }
      if (user) {
        const token = randomBytes(32).toString('hex')
        await repository.createPasswordReset(token, user.id, new Date(Date.now() + passwordResetMaxAge))
        await sendPasswordResetEmail(user.email, token)
        if (!isProduction) payload.resetToken = token
      }
      return sendJson(response, 200, payload)
    }

    if (pathname === '/api/auth/reset-password' && request.method === 'POST') {
      const { token, password } = await readBody(request)
      if (!token || !password || password.length < 6) return sendJson(response, 400, { error: 'A valid token and a 6-character password are required' })
      const userId = await repository.consumePasswordReset(token)
      if (!userId) return sendJson(response, 400, { error: 'This reset link is invalid or has expired' })
      const user = await repository.findById(userId)
      user.passwordHash = hashPassword(password)
      await repository.update(user)
      await repository.deleteUserSessions(userId)
      return sendJson(response, 200, { message: 'Password updated. You can now sign in.' })
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = cookieValue(request)
      if (token) await repository.deleteSession(token)
      return sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
    }

    if (pathname === '/api/auth/me' && request.method === 'GET') {
      const user = await currentUser(request)
      return user ? sendJson(response, 200, { user: publicUser(user) }) : sendJson(response, 401, { error: 'Not authenticated' })
    }

    if (pathname === '/api/farm' && (request.method === 'GET' || request.method === 'PUT')) {
      const user = await currentUser(request)
      if (!user) return sendJson(response, 401, { error: 'Authentication required' })
      if (request.method === 'PUT') user.farm = await readBody(request)
      if (request.method === 'PUT') await repository.update(user)
      return sendJson(response, 200, user.farm)
    }

    if (request.method === 'GET' && !pathname.startsWith('/api/')) {
      const requestedFile = pathname === '/' ? 'index.html' : pathname.slice(1)
      const filePath = resolve(distDir, requestedFile)
      try {
        const content = await readFile(filePath)
        const contentTypes = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
        response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'text/html' })
        response.end(content)
      } catch {
        const content = await readFile(resolve(distDir, 'index.html'))
        response.writeHead(200, { 'Content-Type': 'text/html' })
        response.end(content)
      }
      return
    }

    return sendJson(response, 404, { error: 'Route not found' })
  } catch (error) {
    console.error(error)
    return sendJson(response, 500, { error: 'Unable to process request' })
  }
})

server.listen(port, () => console.log(`PoultryPro API listening on http://localhost:${port} (${repository.mode})`))
