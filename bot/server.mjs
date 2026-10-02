import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { parseTelegramMessage } from '../src/validation.js'

const { Pool } = pg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'data', 'db.json')
const ENV_PATH = path.join(__dirname, '..', '.env')

// Load .env if exists
try {
  const envContent = await fs.readFile(ENV_PATH, 'utf-8')
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
} catch {
  // Rely on existing process.env
}

const PORT = Number(process.env.PORT) || 3001
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''
const DATABASE_URL = process.env.DATABASE_URL || ''
const JWT_SECRET = process.env.JWT_SECRET || 'finnote-jwt-secret-local-key-2026'

// --- Crypto & Auth Helpers (Stdlib zero-dependency) ---
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const calculated = crypto.scryptSync(password, salt, 64).toString('hex')
  return calculated === hash
}

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + (30 * 86400) // 30 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url')
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyJwt(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  if (expectedSig !== signature) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// --- Database & Storage Layer ---
let pgPool = null
let usePostgres = false

async function initPostgres() {
  if (!DATABASE_URL) return false
  try {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 3500
    })
    const client = await pool.connect()
    client.release()
    pgPool = pool
    usePostgres = true
    console.log('[FinNote Database] Berhasil terhubung ke PostgreSQL!')

    // Auto-run migration
    try {
      const migrationSql = await fs.readFile(path.join(__dirname, '..', 'db', '001_init.sql'), 'utf-8')
      await pgPool.query(migrationSql)
      console.log('[FinNote Database] Migrasi PostgreSQL 001_init.sql selesai.')
    } catch (migErr) {
      console.warn('[FinNote Database] Peringatan migrasi:', migErr.message)
    }
    return true
  } catch (err) {
    console.warn('[FinNote Database] Tidak dapat terhubung ke PostgreSQL (' + err.message + '). Menggunakan fallback storage lokal.')
    return false
  }
}

// Fallback JSON DB
async function initFileDb() {
  await fs.mkdir(path.join(__dirname, 'data'), { recursive: true })
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    if (!parsed.users) parsed.users = []
    if (!parsed.transactions) parsed.transactions = []
    if (!parsed.pairings) parsed.pairings = {}
    return parsed
  } catch {
    const initial = { users: [], transactions: [], pairings: {} }
    await fs.writeFile(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

async function writeFileDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

await initPostgres()
const fileDb = await initFileDb()

// Unified Data Access Layer (PostgreSQL or File fallback)
const dbService = {
  async findUserByEmail(email) {
    const cleanEmail = email.trim().toLowerCase()
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [cleanEmail])
      return res.rows[0] || null
    }
    return fileDb.users.find(u => u.email.toLowerCase() === cleanEmail) || null
  },

  async findUserById(id) {
    if (usePostgres) {
      const res = await pgPool.query('SELECT id, email, name, telegram_chat_id, created_at FROM users WHERE id = $1 LIMIT 1', [id])
      return res.rows[0] || null
    }
    const u = fileDb.users.find(user => user.id === id)
    if (!u) return null
    const { password_hash, ...safe } = u
    return safe
  },

  async findUserByTelegramChatId(chatId) {
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM users WHERE telegram_chat_id = $1 LIMIT 1', [chatId])
      return res.rows[0] || null
    }
    return fileDb.users.find(u => String(u.telegram_chat_id) === String(chatId)) || null
  },

  async createUser({ email, password, name }) {
    const id = crypto.randomUUID()
    const password_hash = hashPassword(password)
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()

    if (usePostgres) {
      const res = await pgPool.query(
        'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at',
        [id, cleanEmail, password_hash, cleanName]
      )
      return res.rows[0]
    }

    const newUser = { id, email: cleanEmail, password_hash, name: cleanName, telegram_chat_id: null, created_at: new Date().toISOString() }
    fileDb.users.push(newUser)
    await writeFileDb(fileDb)
    return { id, email: cleanEmail, name: cleanName, created_at: newUser.created_at }
  },

  async linkTelegram(userId, chatId) {
    if (usePostgres) {
      await pgPool.query('UPDATE users SET telegram_chat_id = $1 WHERE id = $2', [chatId, userId])
      return true
    }
    const u = fileDb.users.find(user => user.id === userId)
    if (u) {
      u.telegram_chat_id = chatId
      await writeFileDb(fileDb)
      return true
    }
    return false
  },

  async unlinkTelegram(userId) {
    if (usePostgres) {
      await pgPool.query('UPDATE users SET telegram_chat_id = NULL WHERE id = $1', [userId])
      return true
    }
    const u = fileDb.users.find(user => user.id === userId)
    if (u) {
      u.telegram_chat_id = null
      await writeFileDb(fileDb)
      return true
    }
    return false
  },

  async createPairingCode(userId) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 mins

    if (usePostgres) {
      await pgPool.query('DELETE FROM telegram_pairings WHERE user_id = $1', [userId])
      await pgPool.query('INSERT INTO telegram_pairings (code, user_id, expires_at) VALUES ($1, $2, $3)', [code, userId, expiresAt])
      return code
    }

    fileDb.pairings[code] = { userId, expiresAt: expiresAt.toISOString() }
    await writeFileDb(fileDb)
    return code
  },

  async consumePairingCode(code) {
    const cleanCode = code.trim()
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM telegram_pairings WHERE code = $1 AND expires_at > now() LIMIT 1', [cleanCode])
      if (res.rows.length === 0) return null
      const pairing = res.rows[0]
      await pgPool.query('DELETE FROM telegram_pairings WHERE code = $1', [cleanCode])
      return pairing.user_id
    }

    const p = fileDb.pairings[cleanCode]
    if (!p) return null
    if (new Date(p.expiresAt) < new Date()) {
      delete fileDb.pairings[cleanCode]
      await writeFileDb(fileDb)
      return null
    }
    delete fileDb.pairings[cleanCode]
    await writeFileDb(fileDb)
    return p.userId
  },

  async getTransactions(userId) {
    if (usePostgres) {
      const res = await pgPool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC', [userId])
      return res.rows.map(r => ({ ...r, amount: Number(r.amount) }))
    }
    return fileDb.transactions
      .filter(t => !userId || t.user_id === userId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  },

  async addTransaction(userId, txData) {
    const id = txData.id || crypto.randomUUID()
    const amount = Number(txData.amount) || 0
    const now = new Date().toISOString()
    const date = txData.date || now.slice(0, 10)

    if (usePostgres) {
      const res = await pgPool.query(
        'INSERT INTO transactions (id, user_id, type, amount, title, category, date, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [id, userId, txData.type, amount, txData.title, txData.category, date, txData.note || '', now]
      )
      return { ...res.rows[0], amount: Number(res.rows[0].amount) }
    }

    const newTx = { ...txData, id, user_id: userId, amount, date, created_at: now }
    fileDb.transactions.unshift(newTx)
    await writeFileDb(fileDb)
    return newTx
  },

  async deleteTransaction(userId, txId) {
    if (usePostgres) {
      await pgPool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId])
      return true
    }
    fileDb.transactions = fileDb.transactions.filter(t => !(t.id === txId && (!userId || t.user_id === userId)))
    await writeFileDb(fileDb)
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

// Helper format rupiah & text escaping
const rupiahFormat = num => 'Rp ' + Number(num || 0).toLocaleString('id-ID')
const escapeHtml = (str = '') => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const getLocalDateStr = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// --- Telegram Bot Integration ---
let botUsername = ''

async function callTelegram(method, body) {
  if (!BOT_TOKEN) return null
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return await res.json()
  } catch (err) {
    console.error(`[Telegram Error] ${method}:`, err.message)
    return null
  }
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const res = await callTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })
  if (!res || !res.ok) {
    return callTelegram('sendMessage', { chat_id: chatId, text: text.replace(/<[^>]*>/g, ''), ...extra })
  }
  return res
}

async function setupBot() {
  if (!BOT_TOKEN) {
    console.log('[FinNote Bot] TELEGRAM_BOT_TOKEN belum diatur. Server API tetap aktif.')
    return
  }

  const me = await callTelegram('getMe', {})
  if (me && me.ok) {
    botUsername = me.result.username
    console.log(`[FinNote Bot] Aktif sebagai @${botUsername}`)
    await callTelegram('setMyCommands', {
      commands: [
        { command: 'saldo', description: 'Cek saldo dan total pengeluaran' },
        { command: 'rekap', description: 'Lihat rekap transaksi hari ini' },
        { command: 'link', description: 'Hubungkan dengan kode pairing web (/link 123456)' },
        { command: 'unlink', description: 'Putuskan hubungan akun Telegram' },
        { command: 'help', description: 'Panduan penggunaan bot' }
      ]
    })
    startPolling()
  } else {
    console.error('[FinNote Bot] Gagal verifikasi bot token:', me?.description || 'Error')
  }
}

let lastUpdateId = 0
let isPolling = false

async function startPolling() {
  if (isPolling) return
  isPolling = true

  while (isPolling) {
    try {
      const res = await callTelegram('getUpdates', { offset: lastUpdateId + 1, timeout: 25 })
      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          lastUpdateId = update.update_id
          if (update.message?.text) {
            await handleTelegramMessage(update.message).catch(e => console.error('[Bot Msg Error]:', e))
          }
        }
      } else {
        await new Promise(r => setTimeout(r, 3000))
      }
    } catch {
      await new Promise(r => setTimeout(r, 4000))
    }
  }
}

async function handleTelegramMessage(message) {
  const chatId = message.chat?.id
  if (!chatId) return
  const text = (message.text || '').trim()
  if (!text) return

  const lowerText = text.toLowerCase()
  const cleanCmd = lowerText.replace(/@\w+bot\b/gi, '').trim()
  const todayStr = getLocalDateStr()

  // 1. Linking command: /link 123456
  if (cleanCmd.startsWith('/link')) {
    const parts = text.split(/\s+/)
    const code = parts[1]
    if (!code) {
      await sendTelegramMessage(chatId, '⚠️ Masukkan kode 6 digit dari web FinNote.\nContoh: <code>/link 849201</code>')
      return
    }

    const userId = await dbService.consumePairingCode(code)
    if (!userId) {
      await sendTelegramMessage(chatId, '❌ Kode pairing tidak valid atau sudah kedaluwarsa. Buka web FinNote > Pengaturan untuk membuat kode baru.')
      return
    }

    await dbService.linkTelegram(userId, chatId)
    const user = await dbService.findUserById(userId)
    await sendTelegramMessage(chatId, `🎉 <b>Berhasil Terhubung!</b>\nAkun Telegram kamu kini terhubung dengan akun FinNote: <b>${escapeHtml(user?.name || user?.email)}</b>.\n\nSekarang kamu bisa langsung mencatat transaksi via chat, contoh: <code>kopi 25k</code> atau <code>gaji 5jt</code>.`)
    return
  }

  // 2. Unlink command
  if (cleanCmd === '/unlink') {
    const user = await dbService.findUserByTelegramChatId(chatId)
    if (!user) {
      await sendTelegramMessage(chatId, 'ℹ️ Akun Telegram ini belum terhubung ke akun FinNote manapun.')
      return
    }
    await dbService.unlinkTelegram(user.id)
    await sendTelegramMessage(chatId, '✅ Akun Telegram berhasil diputuskan dari FinNote.')
    return
  }

  // 3. User Resolution (Multi-Tenant check)
  let user = await dbService.findUserByTelegramChatId(chatId)

  // Start & Help Commands
  if (cleanCmd.startsWith('/start') || cleanCmd.startsWith('/help') || cleanCmd === 'bantuan') {
    const firstName = escapeHtml(message.from?.first_name || 'teman')
    const welcome = `👋 <b>Halo ${firstName}!</b>\n\n` +
      `Selamat datang di <b>FinNote Bot</b>.\n\n` +
      (user
        ? `✅ Akun terhubung: <b>${escapeHtml(user.name)}</b> (${escapeHtml(user.email)})\n\n`
        : `⚠️ <b>Akun Telegram belum terhubung ke FinNote!</b>\nBuka web FinNote > Pengaturan > <b>Hubungkan Telegram</b> untuk mendapatkan kode pairing, lalu kirim perintah:\n<code>/link [kode_6_angka]</code>\n\n`) +
      `<b>💡 Cara Mencatat Cepat:</b>\n` +
      `• <code>Kopi 25k</code> (Pengeluaran Makan)\n` +
      `• <code>Bensin 50rb</code> (Pengeluaran Transport)\n` +
      `• <code>Makan siang 35.000</code>\n` +
      `• <code>Gaji 5jt</code> atau <code>+1.5jt freelance</code> (Pemasukan)\n\n` +
      `<b>📊 Perintah:</b>\n` +
      `• /saldo - Cek saldo akun kamu\n` +
      `• /rekap - Rekap transaksi hari ini\n` +
      `• /link [kode] - Hubungkan akun web`

    const replyMarkup = WEBAPP_URL ? {
      reply_markup: {
        inline_keyboard: [[{ text: '📱 Buka Web FinNote', web_app: { url: WEBAPP_URL } }]]
      }
    } : undefined

    await sendTelegramMessage(chatId, welcome, replyMarkup)
    return
  }

  // Require paired account for logging transactions and checking saldo
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `🔒 <b>Akun Telegram belum terhubung ke FinNote.</b>\n\n` +
      `Untuk mencatat dan melihat saldo pribadi, hubungkan akunmu terlebih dahulu:\n` +
      `1. Login ke web FinNote\n` +
      `2. Buka menu <b>Pengaturan</b>\n` +
      `3. Klik <b>Buat Kode Pairing</b>\n` +
      `4. Kirim ke sini: <code>/link [kode]</code>`
    )
    return
  }

  // Saldo
  if (cleanCmd === '/saldo' || cleanCmd === 'saldo') {
    const txs = await dbService.getTransactions(user.id)
    const currentMonth = todayStr.slice(0, 7)
    let income = 0
    let expense = 0
    let monthExpense = 0

    for (const t of txs) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') {
        expense += t.amount
        if (t.date?.startsWith(currentMonth)) monthExpense += t.amount
      }
    }

    const reply = `📊 <b>Ringkasan Keuangan — ${escapeHtml(user.name)}</b>\n\n` +
      `💰 Saldo: <b>${rupiahFormat(income - expense)}</b>\n` +
      `📈 Pemasukan: ${rupiahFormat(income)}\n` +
      `📉 Pengeluaran: ${rupiahFormat(expense)}\n` +
      `🗓️ Pengeluaran Bulan Ini: <b>${rupiahFormat(monthExpense)}</b>\n\n` +
      `<i>${txs.length} transaksi tercatat.</i>`

    await sendTelegramMessage(chatId, reply)
    return
  }

  // Rekap
  if (cleanCmd === '/rekap' || cleanCmd === 'rekap') {
    const txs = await dbService.getTransactions(user.id)
    const todayItems = txs.filter(t => t.date === todayStr)
    if (todayItems.length === 0) {
      await sendTelegramMessage(chatId, `🗓️ Belum ada transaksi untuk hari ini (${todayStr}).`)
      return
    }

    const todayExpense = todayItems.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const todayIncome = todayItems.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

    const listStr = todayItems.slice(0, 10).map(t => {
      const sign = t.type === 'income' ? '🟢 +' : '🔴 -'
      return `${sign} <b>${escapeHtml(t.title)}</b>: ${rupiahFormat(t.amount)}`
    }).join('\n')

    const reply = `🗓️ <b>Rekap Hari Ini (${todayStr})</b>\n\n` +
      `${listStr}\n\n` +
      `📉 Total Keluar: <b>${rupiahFormat(todayExpense)}</b>\n` +
      (todayIncome > 0 ? `📈 Total Masuk: <b>${rupiahFormat(todayIncome)}</b>\n` : '')

    await sendTelegramMessage(chatId, reply)
    return
  }

  // Parse transaction from text
  const parsed = parseTelegramMessage(text, todayStr)
  if (!parsed) {
    await sendTelegramMessage(chatId, `⚠️ Format belum terbaca. Contoh:\n• <code>Kopi 25k</code>\n• <code>Bensin 50rb</code>\n• <code>Makan siang 35.000</code>`)
    return
  }

  // Save to user account
  const newTx = await dbService.addTransaction(user.id, parsed)
  const isIncome = newTx.type === 'income'
  const icon = isIncome ? '🟢' : '🔴'
  const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran'

  const confirmation = `✅ <b>Berhasil Dicatat!</b>\n\n` +
    `${icon} <b>${typeLabel}:</b> ${rupiahFormat(newTx.amount)}\n` +
    `📌 <b>Nama:</b> ${escapeHtml(newTx.title)}\n` +
    `🏷️ <b>Kategori:</b> ${escapeHtml(newTx.category)}\n` +
    `📅 <b>Tanggal:</b> ${newTx.date}`

  await sendTelegramMessage(chatId, confirmation)
}

// --- HTTP API Server ---
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  const getBody = () => new Promise(resolve => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })

  // Auth Extraction
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const authUser = token ? verifyJwt(token) : null

  // --- Public Status Endpoint ---
  if (url.pathname === '/api/status' && req.method === 'GET') {
    return sendJson(200, {
      ok: true,
      botActive: Boolean(botUsername),
      botUsername: botUsername || null,
      hasToken: Boolean(BOT_TOKEN),
      usePostgres,
      timestamp: new Date().toISOString()
    })
  }

  // --- Auth: Register ---
  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await getBody()
    const { email, password, name } = body
    if (!email || !password || !name) {
      return sendJson(400, { error: 'Email, password, dan nama wajib diisi.' })
    }
    if (password.length < 6) {
      return sendJson(400, { error: 'Password minimal 6 karakter.' })
    }

    const existing = await dbService.findUserByEmail(email)
    if (existing) {
      return sendJson(409, { error: 'Email sudah terdaftar. Silakan masuk.' })
    }

    const user = await dbService.createUser({ email, password, name })
    const authToken = signJwt({ id: user.id, email: user.email, name: user.name })
    return sendJson(201, { ok: true, token: authToken, user })
  }

  // --- Auth: Login ---
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await getBody()
    const { email, password } = body
    if (!email || !password) {
      return sendJson(400, { error: 'Email dan password wajib diisi.' })
    }

    const user = await dbService.findUserByEmail(email)
    if (!user || !verifyPassword(password, user.password_hash)) {
      return sendJson(401, { error: 'Email atau password salah.' })
    }

    const authToken = signJwt({ id: user.id, email: user.email, name: user.name })
    return sendJson(200, {
      ok: true,
      token: authToken,
      user: { id: user.id, email: user.email, name: user.name, telegram_chat_id: user.telegram_chat_id }
    })
  }

  // --- Auth: Me ---
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    if (!authUser) return sendJson(401, { error: 'Unauthorized' })
    const user = await dbService.findUserById(authUser.id)
    if (!user) return sendJson(404, { error: 'User tidak ditemukan' })
    return sendJson(200, { ok: true, user })
  }

  // --- Telegram: Generate Pairing Code ---
  if (url.pathname === '/api/telegram/pair-code' && req.method === 'POST') {
    if (!authUser) return sendJson(401, { error: 'Unauthorized' })
    const code = await dbService.createPairingCode(authUser.id)
    return sendJson(200, { ok: true, code, botUsername })
  }

  // --- Telegram: Unlink ---
  if (url.pathname === '/api/telegram/unlink' && req.method === 'POST') {
    if (!authUser) return sendJson(401, { error: 'Unauthorized' })
    await dbService.unlinkTelegram(authUser.id)
    return sendJson(200, { ok: true })
  }

  // --- Transactions: List ---
  if (url.pathname === '/api/transactions' && req.method === 'GET') {
    // If authenticated, get user transactions. If unauthenticated, fallback to public fileDb transactions
    const userId = authUser?.id || null
    const txs = await dbService.getTransactions(userId)
    return sendJson(200, txs)
  }

  // --- Transactions: Create ---
  if (url.pathname === '/api/transactions' && req.method === 'POST') {
    const body = await getBody()
    if (!body.title || !body.amount) {
      return sendJson(400, { error: 'Judul dan nominal wajib diisi' })
    }
    const userId = authUser?.id || null
    const tx = await dbService.addTransaction(userId, body)
    return sendJson(201, tx)
  }

  // --- Transactions: Delete ---
  if (url.pathname.startsWith('/api/transactions/') && req.method === 'DELETE') {
    const id = url.pathname.replace('/api/transactions/', '')
    const userId = authUser?.id || null
    await dbService.deleteTransaction(userId, id)
    return sendJson(200, { ok: true, id })
  }

  // --- Transactions: Batch Import ---
  if (url.pathname === '/api/transactions/import' && req.method === 'POST') {
    if (!authUser) return sendJson(401, { error: 'Unauthorized' })
    const body = await getBody()
    const list = Array.isArray(body.transactions) ? body.transactions : []
    const imported = await dbService.importTransactions(authUser.id, list)
    return sendJson(200, { ok: true, importedCount: imported })
  }

  sendJson(404, { error: 'Not Found' })
})

server.listen(PORT, () => {
  console.log(`[FinNote Server] API siap di http://localhost:${PORT} (Storage: ${usePostgres ? 'PostgreSQL' : 'Local JSON Fallback'})`)
  setupBot()
})
