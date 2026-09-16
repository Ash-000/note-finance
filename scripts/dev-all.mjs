import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')
const botScript = path.join(rootDir, 'bot', 'server.mjs')

console.log('[Dev:All] Memulai FinNote Web dan Telegram Bot...')

const bot = spawn(process.execPath, [botScript], {
  cwd: rootDir,
  stdio: 'inherit'
})

const vite = spawn(process.execPath, [viteBin], {
  cwd: rootDir,
  stdio: 'inherit'
})

const cleanup = (code = 0) => {
  try { bot.kill('SIGINT') } catch {}
  try { vite.kill('SIGINT') } catch {}
  process.exit(code)
}

bot.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`[Dev:All] Bot server berhenti dengan exit code: ${code}`)
  }
})

vite.on('exit', (code) => {
  cleanup(code || 0)
})

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))
process.on('exit', () => cleanup(0))
