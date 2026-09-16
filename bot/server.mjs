import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTelegramMessage } from '../src/validation.js'

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
  // .env file not present or not readable; rely on process.env
}

const PORT = Number(process.env.PORT) || 3001
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''

// Database helpers
async function initDb() {
  await fs.mkdir(path.join(__dirname, 'data'), { recursive: true })
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    const initial = { transactions: [] }
    await fs.writeFile(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

const db = await initDb()

// Helper format rupiah
const rupiahFormat = num => {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID')
}

// Telegram API Helper
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
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  })
}

// Bot logic
let botUsername = ''

async function setupBot() {
  if (!BOT_TOKEN) {
    console.log('[FinNote Bot] TELEGRAM_BOT_TOKEN belum diatur di .env.')
    console.log('[FinNote Bot] Server API tetap aktif untuk sinkronisasi web.')
    return
  }

  const me = await callTelegram('getMe', {})
  if (me && me.ok) {
    botUsername = me.result.username
    console.log(`[FinNote Bot] Berhasil terhubung sebagai @${botUsername}`)
    await callTelegram('setMyCommands', {
      commands: [
        { command: 'saldo', description: 'Cek saldo dan total pengeluaran' },
        { command: 'rekap', description: 'Lihat rekap transaksi hari ini' },
        { command: 'reset', description: 'Reset seluruh data transaksi' },
        { command: 'help', description: 'Panduan cara penggunaan bot' }
      ]
    })
    startPolling()
  } else {
    console.error('[FinNote Bot] Gagal verifikasi Bot Token:', me?.description || 'Unknown error')
  }
}

let lastUpdateId = 0
let isPolling = false

async function startPolling() {
  if (isPolling) return
  isPolling = true

  while (isPolling) {
    try {
      const res = await callTelegram('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 25
      })

      if (res && res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          lastUpdateId = update.update_id
          if (update.message && update.message.text) {
            await handleTelegramMessage(update.message)
          }
        }
      } else {
        await new Promise(r => setTimeout(r, 3000))
      }
    } catch (err) {
      console.error('[FinNote Polling Error]:', err.message)
      await new Promise(r => setTimeout(r, 4000))
    }
  }
}

async function handleTelegramMessage(message) {
  const chatId = message.chat.id
  const text = message.text.trim()
  const todayStr = new Date().toISOString().slice(0, 10)

  // Commands
  if (text.startsWith('/start') || text.startsWith('/help') || text.toLowerCase() === 'bantuan') {
    const welcome = `👋 <b>Halo ${message.from.first_name || 'teman'}!</b>\n\n` +
      `Selamat datang di <b>FinNote Bot</b>. Catat keuangan harianmu langsung dari Telegram.\n\n` +
      `<b>💡 Cara Mencatat Cepat:</b>\n` +
      `• <code>Kopi 25k</code> (Pengeluaran Makan)\n` +
      `• <code>Bensin 50rb</code> (Pengeluaran Transport)\n` +
      `• <code>Makan siang 35.000</code>\n` +
      `• <code>Beli baju 150000</code> (Belanja)\n` +
      `• <code>Listrik 120k</code> (Tagihan)\n` +
      `• <code>Gaji 5jt</code> atau <code>+1.5jt freelance</code> (Pemasukan)\n\n` +
      `<b>📊 Perintah:</b>\n` +
      `• /saldo - Cek ringkasan saldo & pengeluaran\n` +
      `• /rekap - Lihat transaksi hari ini\n` +
      `• /reset - Reset seluruh data transaksi\n` +
      `• /help - Bantuan format chat`

    const replyMarkup = WEBAPP_URL ? {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Buka Web FinNote', web_app: { url: WEBAPP_URL } }]
        ]
      }
    } : undefined

    await sendTelegramMessage(chatId, welcome, replyMarkup)
    return
  }

  if (text === '/saldo' || text.toLowerCase() === 'saldo') {
    const currentMonth = todayStr.slice(0, 7)
    let income = 0
    let expense = 0

    for (const t of db.transactions) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
    }

    const monthExpenses = db.transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0)

    const balance = income - expense
    const reply = `📊 <b>Ringkasan FinNote</b>\n\n` +
      `💰 Saldo Total: <b>${rupiahFormat(balance)}</b>\n` +
      `📈 Total Pemasukan: ${rupiahFormat(income)}\n` +
      `📉 Total Pengeluaran: ${rupiahFormat(expense)}\n` +
      `🗓️ Pengeluaran Bulan Ini: <b>${rupiahFormat(monthExpenses)}</b>\n\n` +
      `<i>Total ${db.transactions.length} transaksi tercatat.</i>`

    await sendTelegramMessage(chatId, reply)
    return
  }

  if (text === '/rekap' || text.toLowerCase() === 'rekap') {
    const todayItems = db.transactions.filter(t => t.date === todayStr)
    if (todayItems.length === 0) {
      await sendTelegramMessage(chatId, `🗓️ Belum ada transaksi yang dicatat untuk hari ini (${todayStr}).`)
      return
    }

    const todayExpense = todayItems.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const todayIncome = todayItems.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

    let listStr = todayItems.slice(0, 10).map(t => {
      const sign = t.type === 'income' ? '🟢 +' : '🔴 -'
      return `${sign} <b>${t.title}</b> (${t.category}): ${rupiahFormat(t.amount)}`
    }).join('\n')

    const reply = `🗓️ <b>Rekap Hari Ini (${todayStr})</b>\n\n` +
      `${listStr}\n\n` +
      `📉 Total Keluar: <b>${rupiahFormat(todayExpense)}</b>\n` +
      (todayIncome > 0 ? `📈 Total Masuk: <b>${rupiahFormat(todayIncome)}</b>\n` : '')

    await sendTelegramMessage(chatId, reply)
    return
  }

  const cleanCmd = text.trim().toLowerCase()
  if (cleanCmd === '/reset' || cleanCmd.startsWith('/reset ') || cleanCmd === 'reset') {
    const totalCount = db.transactions.length
    if (totalCount === 0) {
      await sendTelegramMessage(chatId, `ℹ️ <b>Data transaksi sudah kosong.</b>\nTidak ada transaksi yang perlu direset.`)
      return
    }

    db.transactions = []
    db.lastReset = new Date().toISOString()
    await writeDb(db)

    const reply = `🗑️ <b>Semua Data Transaksi Berhasil Direset!</b>\n\n` +
      `Sebanyak <b>${totalCount} transaksi</b> telah dihapus dari FinNote.\n` +
      `Saldo dan riwayat pencatatan kini kembali ke Rp 0.\n\n` +
      `💡 <i>Kamu bisa langsung mulai mencatat transaksi baru, contoh: <code>kopi 25k</code> atau <code>gaji 5jt</code>.</i>`

    await sendTelegramMessage(chatId, reply)
    return
  }

  // Parse transaction from text
  const parsed = parseTelegramMessage(text, todayStr)
  if (!parsed) {
    const guide = `⚠️ Format belum terbaca.\n\n` +
      `Contoh cara catat:\n` +
      `• <code>Kopi 25k</code>\n` +
      `• <code>Bensin 50rb</code>\n` +
      `• <code>Makan siang 35.000</code>\n` +
      `• <code>Gaji 5.000.000</code>\n` +
      `• Atau ketik /saldo untuk cek saldo.`
    await sendTelegramMessage(chatId, guide)
    return
  }

  // Save to DB
  const newTx = {
    ...parsed,
    id: 'tg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString()
  }

  db.transactions.unshift(newTx)
  await writeDb(db)

  // Calculate monthly stats for context
  const currentMonth = todayStr.slice(0, 7)
  const monthExpense = db.transactions
    .filter(t => t.type === 'expense' && t.date?.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const isIncome = newTx.type === 'income'
  const icon = isIncome ? '🟢' : '🔴'
  const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran'

  const confirmation = `✅ <b>Berhasil Dicatat!</b>\n\n` +
    `${icon} <b>${typeLabel}:</b> ${rupiahFormat(newTx.amount)}\n` +
    `📌 <b>Nama:</b> ${newTx.title}\n` +
    `🏷️ <b>Kategori:</b> ${newTx.category}\n` +
    `📅 <b>Tanggal:</b> ${newTx.date}\n\n` +
    (!isIncome ? `📊 Pengeluaran bulan ini: <b>${rupiahFormat(monthExpense)}</b>` : `💰 Transaksi telah tersimpan ke FinNote.`)

  await sendTelegramMessage(chatId, confirmation)
}

// HTTP API Server (native node:http)
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  // JSON helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  // Body parser helper
  const getBody = () => new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })

  // Routes
  if (url.pathname === '/api/status' && req.method === 'GET') {
    return sendJson(200, {
      ok: true,
      botActive: Boolean(botUsername),
      botUsername: botUsername || null,
      transactionsCount: db.transactions.length,
      hasToken: Boolean(BOT_TOKEN),
      lastReset: db.lastReset || null
    })
  }

  if (url.pathname === '/api/transactions' && req.method === 'GET') {
    return sendJson(200, db.transactions)
  }

  if (url.pathname === '/api/reset' && req.method === 'POST') {
    const totalCount = db.transactions.length
    db.transactions = []
    db.lastReset = new Date().toISOString()
    await writeDb(db)
    return sendJson(200, { ok: true, deletedCount: totalCount, transactions: [], lastReset: db.lastReset })
  }

  if (url.pathname === '/api/transactions' && req.method === 'POST') {
    const body = await getBody()
    if (!body.title || !body.amount) {
      return sendJson(400, { error: 'Judul dan nominal wajib diisi' })
    }
    const tx = {
      ...body,
      id: body.id || 'web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      date: body.date || new Date().toISOString().slice(0, 10),
      createdAt: body.createdAt || new Date().toISOString()
    }
    db.transactions.unshift(tx)
    await writeDb(db)
    return sendJson(201, tx)
  }

  if (url.pathname.startsWith('/api/transactions/') && req.method === 'DELETE') {
    const id = url.pathname.replace('/api/transactions/', '')
    db.transactions = db.transactions.filter(t => t.id !== id)
    await writeDb(db)
    return sendJson(200, { ok: true, id })
  }

  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const { transactions: clientTxs = [], lastReset: clientReset } = await getBody()
    
    // Abaikan data lama client jika server telah direset lebih baru daripada client
    const isClientBehindReset = Boolean(db.lastReset && (!clientReset || clientReset < db.lastReset))

    const map = new Map()
    // Server items first
    for (const t of db.transactions) map.set(t.id, t)
    
    // Merge client items jika tidak terhalang reset
    if (!isClientBehindReset) {
      for (const t of clientTxs) {
        if (!map.has(t.id)) map.set(t.id, t)
      }
    }
    
    db.transactions = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    await writeDb(db)
    return sendJson(200, { ok: true, transactions: db.transactions, lastReset: db.lastReset || null })
  }

  sendJson(404, { error: 'Not Found' })
})

server.listen(PORT, () => {
  console.log(`[FinNote Server] API siap di http://localhost:${PORT}`)
  setupBot()
})
