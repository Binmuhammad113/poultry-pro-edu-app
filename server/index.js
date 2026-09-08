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

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})

  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname
    if (pathname === '/api/health' && request.method === 'GET') return sendJson(response, 200, { ok: true, service: 'poultrypro-api' })

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      const { name, email, password } = await readBody(request)
      if (!name || !email || !password || password.length < 6) return sendJson(response, 400, { error: 'Name, email, and a 6-character password are required' })
      if (await repository.findByEmail(email.toLowerCase())) return sendJson(response, 409, { error: 'An account with this email already exists' })
      const user = await repository.create({ id: randomUUID(), name, email: email.toLowerCase(), passwordHash: hashPassword(password), farm: newFarmForUser(name) })
      const session = randomBytes(24).toString('hex')
      await repository.createSession(session, user.id, new Date(Date.now() + sessionMaxAge * 1000))
      return sendJson(response, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) })
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const { email, password } = await readBody(request)
      const user = await repository.findByEmail(email?.toLowerCase())
      if (!user || !verifyPassword(password || '', user.passwordHash)) return sendJson(response, 401, { error: 'Incorrect email or password' })
      const session = randomBytes(24).toString('hex')
      await repository.createSession(session, user.id, new Date(Date.now() + sessionMaxAge * 1000))
      return sendJson(response, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) })
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
