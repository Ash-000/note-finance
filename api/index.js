import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pg from 'pg'

const { Pool } = pg

// Load local .env if present and DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim()
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
    }
  } catch {
    // Rely on process.env
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'finnote-jwt-secret-local-key-2026'

// --- Crypto & Auth Helpers ---
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const calculated = crypto.scryptSync(password, salt, 64).toString('hex')
  return calculated === hash
}

export function signJwt(payload) {
  const secret = process.env.JWT_SECRET || JWT_SECRET
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + (30 * 86400) // 30 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyJwt(token) {
  if (!token) return null
  const secret = process.env.JWT_SECRET || JWT_SECRET
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  if (expectedSig !== signature) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// --- Database Connection Pool (Lazy Singleton for Serverless & Long-running) ---
let pgPool = null

export function getPool() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null
  if (!pgPool) {
    const isSupabase = dbUrl.includes('supabase.co') || dbUrl.includes('pooler.supabase.com')
    pgPool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 5000,
      max: 4,
      idleTimeoutMillis: 30000,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined
    })
    pgPool.on('error', err => {
      console.error('[FinNote DB Pool Error]:', err.message)
    })
  }
  return pgPool
}

// In-memory fallback if DATABASE_URL is not set
const memDb = {
  users: [],
  transactions: [],
  pairings: {}
}

export const dbService = {
  async findUserByEmail(email) {
    const cleanEmail = email.trim().toLowerCase()
    const pool = getPool()
    if (pool) {
      const res = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [cleanEmail])
      return res.rows[0] || null
    }
    return memDb.users.find(u => u.email.toLowerCase() === cleanEmail) || null
  },

  async findUserById(id) {
    const pool = getPool()
    if (pool) {
      const res = await pool.query('SELECT id, email, name, telegram_chat_id, created_at FROM users WHERE id = $1 LIMIT 1', [id])
      return res.rows[0] || null
    }
    const u = memDb.users.find(user => user.id === id)
    if (!u) return null
    const { password_hash, ...safe } = u
    return safe
  },

  async findUserByTelegramChatId(chatId) {
    const pool = getPool()
    if (pool) {
      const res = await pool.query('SELECT * FROM users WHERE telegram_chat_id = $1 LIMIT 1', [chatId])
      return res.rows[0] || null
    }
    return memDb.users.find(u => String(u.telegram_chat_id) === String(chatId)) || null
  },

  async createUser({ email, password, name }) {
    const id = crypto.randomUUID()
    const password_hash = hashPassword(password)
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const pool = getPool()
    if (pool) {
      const res = await pool.query(
        'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at',
        [id, cleanEmail, password_hash, cleanName]
      )
      return res.rows[0]
    }
    const newUser = { id, email: cleanEmail, password_hash, name: cleanName, telegram_chat_id: null, created_at: new Date().toISOString() }
    memDb.users.push(newUser)
    return { id, email: cleanEmail, name: cleanName, created_at: newUser.created_at }
  },

  async linkTelegram(userId, chatId) {
    const pool = getPool()
    if (pool) {
      await pool.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', [chatId, userId])
      return true
    }
    const u = memDb.users.find(user => user.id === userId)
    if (u) {
      u.telegram_chat_id = chatId
      return true
    }
    return false
  },

  async unlinkTelegram(userId) {
    const pool = getPool()
    if (pool) {
      await pool.query('UPDATE users SET telegram_chat_id = NULL WHERE id = $1', [userId])
      return true
    }
    const u = memDb.users.find(user => user.id === userId)
    if (u) {
      u.telegram_chat_id = null
      return true
    }
    return false
  },

  async createPairingCode(userId) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const pool = getPool()
    if (pool) {
      await pool.query('DELETE FROM telegram_pairings WHERE user_id = $1', [userId])
      await pool.query('INSERT INTO telegram_pairings (code, user_id, expires_at) VALUES ($1, $2, $3)', [code, userId, expiresAt])
      return code
    }
    memDb.pairings[code] = { userId, expiresAt: expiresAt.toISOString() }
    return code
  },

  async consumePairingCode(code) {
    const cleanCode = code.trim()
    const pool = getPool()
    if (pool) {
      const res = await pool.query('SELECT * FROM telegram_pairings WHERE code = $1 AND expires_at > now() LIMIT 1', [cleanCode])
      if (res.rows.length === 0) return null
      const pairing = res.rows[0]
      await pool.query('DELETE FROM telegram_pairings WHERE code = $1', [cleanCode])
      return pairing.user_id
    }
    const p = memDb.pairings[cleanCode]
    if (!p) return null
    if (new Date(p.expiresAt) < new Date()) {
      delete memDb.pairings[cleanCode]
      return null
    }
    delete memDb.pairings[cleanCode]
    return p.userId
  },

  async getTransactions(userId) {
    const pool = getPool()
    if (pool) {
      const res = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC', [userId])
      return res.rows.map(r => ({ ...r, amount: Number(r.amount) }))
    }
    return memDb.transactions
      .filter(t => !userId || t.user_id === userId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  },

  async addTransaction(userId, txData) {
    const id = txData.id || crypto.randomUUID()
    const amount = Number(txData.amount) || 0
    const now = new Date().toISOString()
    const date = txData.date || now.slice(0, 10)
    const pool = getPool()
    if (pool) {
      const res = await pool.query(
        'INSERT INTO transactions (id, user_id, type, amount, title, category, date, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [id, userId, txData.type, amount, txData.title, txData.category, date, txData.note || '', now]
      )
      return { ...res.rows[0], amount: Number(res.rows[0].amount) }
    }
    const newTx = { ...txData, id, user_id: userId, amount, date, created_at: now }
    memDb.transactions.unshift(newTx)
    return newTx
  },

  async deleteTransaction(userId, txId) {
    const pool = getPool()
    if (pool) {
      await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId])
      return true
    }
    memDb.transactions = memDb.transactions.filter(t => !(t.id === txId && (!userId || t.user_id === userId)))
    return true
  },

  async importTransactions(userId, list = []) {
    let count = 0
    for (const item of list) {
      if (!item.title || !item.amount) continue
      await this.addTransaction(userId, item)
      count++
    }
    return count
  }
}

export let activeBotUsername = ''
export function setActiveBotUsername(name) {
  activeBotUsername = name
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data)
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return new Promise(resolve => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

// --- Request Handler (compatible with Vercel Serverless Function and Node http.createServer) ---
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(204).end()
    }
    res.writeHead(204)
    res.end()
    return
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  let pathname = parsedUrl.pathname
  const pathParam = parsedUrl.searchParams.get('_path') || (req.query && req.query._path)
  if (pathParam) {
    pathname = '/api/' + String(pathParam).replace(/^\/+/, '')
  }
  pathname = pathname.replace(/\/+$/, '')

  // Auth Extraction
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const authUser = token ? verifyJwt(token) : null

  // --- Base API Route ---
  if (pathname === '/api' || pathname === '') {
    return sendJson(res, 200, { ok: true, name: 'FinNote API', status: 'running' })
  }

  // --- Public Status Endpoint ---
  if (pathname === '/api/status' && req.method === 'GET') {
    const pool = getPool()
    const botUser = activeBotUsername || process.env.TELEGRAM_BOT_USERNAME || (process.env.TELEGRAM_BOT_TOKEN ? 'Hanz_1_bot' : null)
    return sendJson(res, 200, {
      ok: true,
      botActive: Boolean(botUser),
      botUsername: botUser,
      hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      usePostgres: Boolean(pool),
      timestamp: new Date().toISOString()
    })
  }

  // --- Auth: Register ---
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req)
      const { email, password, name } = body
      if (!email || !password || !name) {
        return sendJson(res, 400, { error: 'Email, password, dan nama wajib diisi.' })
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Password minimal 6 karakter.' })
      }

      const existing = await dbService.findUserByEmail(email)
      if (existing) {
        return sendJson(res, 409, { error: 'Email sudah terdaftar. Silakan masuk.' })
      }

      const user = await dbService.createUser({ email, password, name })
      const authToken = signJwt({ id: user.id, email: user.email, name: user.name })
      return sendJson(res, 201, { ok: true, token: authToken, user })
    } catch (err) {
      console.error('[Register Error]:', err)
      return sendJson(res, 500, { error: 'Gagal mendaftar: ' + (err.message || 'Kesalahan server') })
    }
  }

  // --- Auth: Login ---
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req)
      const { email, password } = body
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email dan password wajib diisi.' })
      }

      const user = await dbService.findUserByEmail(email)
      if (!user || !verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: 'Email atau password salah.' })
      }

      const authToken = signJwt({ id: user.id, email: user.email, name: user.name })
      return sendJson(res, 200, {
        ok: true,
        token: authToken,
        user: { id: user.id, email: user.email, name: user.name, telegram_chat_id: user.telegram_chat_id }
      })
    } catch (err) {
      console.error('[Login Error]:', err)
      return sendJson(res, 500, { error: 'Gagal masuk: ' + (err.message || 'Kesalahan server') })
    }
  }

  // --- Auth: Me ---
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (!authUser) return sendJson(res, 401, { error: 'Unauthorized' })
    const user = await dbService.findUserById(authUser.id)
    if (!user) return sendJson(res, 404, { error: 'User tidak ditemukan' })
    return sendJson(res, 200, { ok: true, user })
  }

  // --- Telegram: Generate Pairing Code ---
  if (pathname === '/api/telegram/pair-code' && req.method === 'POST') {
    if (!authUser) return sendJson(res, 401, { error: 'Unauthorized' })
    const code = await dbService.createPairingCode(authUser.id)
    const botUser = activeBotUsername || process.env.TELEGRAM_BOT_USERNAME || 'Hanz_1_bot'
    return sendJson(res, 200, { ok: true, code, botUsername: botUser })
  }

  // --- Telegram: Unlink ---
  if (pathname === '/api/telegram/unlink' && req.method === 'POST') {
    if (!authUser) return sendJson(res, 401, { error: 'Unauthorized' })
    await dbService.unlinkTelegram(authUser.id)
    return sendJson(res, 200, { ok: true })
  }

  // --- Transactions: List ---
  if (pathname === '/api/transactions' && req.method === 'GET') {
    const userId = authUser?.id || null
    const txs = await dbService.getTransactions(userId)
    return sendJson(res, 200, txs)
  }

  // --- Transactions: Create ---
  if (pathname === '/api/transactions' && req.method === 'POST') {
    const body = await getRequestBody(req)
    if (!body.title || !body.amount) {
      return sendJson(res, 400, { error: 'Judul dan nominal wajib diisi' })
    }
    const userId = authUser?.id || null
    const tx = await dbService.addTransaction(userId, body)
    return sendJson(res, 201, tx)
  }

  // --- Transactions: Delete ---
  if (pathname.startsWith('/api/transactions/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/transactions/', '')
    const userId = authUser?.id || null
    await dbService.deleteTransaction(userId, id)
    return sendJson(res, 200, { ok: true, id })
  }

  // --- Transactions: Batch Import ---
  if (pathname === '/api/transactions/import' && req.method === 'POST') {
    if (!authUser) return sendJson(res, 401, { error: 'Unauthorized' })
    const body = await getRequestBody(req)
    const list = Array.isArray(body.transactions) ? body.transactions : []
    const imported = await dbService.importTransactions(authUser.id, list)
    return sendJson(res, 200, { ok: true, importedCount: imported })
  }

  sendJson(res, 404, { error: `Endpoint ${pathname} tidak ditemukan.` })
}
