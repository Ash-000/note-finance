import http from 'node:http'
import handler, { dbService, setActiveBotUsername, getPool } from '../api/index.js'
import { parseTelegramMessage } from '../src/validation.js'

const PORT = Number(process.env.PORT) || 3001
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const WEBAPP_URL = process.env.WEBAPP_URL || ''

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
    setActiveBotUsername(botUsername)
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

// --- HTTP Server ---
const server = http.createServer(handler)

server.listen(PORT, () => {
  const pool = getPool()
  console.log(`[FinNote Server] API siap di http://localhost:${PORT} (Storage: ${pool ? 'PostgreSQL' : 'In-Memory'})`)
  setupBot()
})
