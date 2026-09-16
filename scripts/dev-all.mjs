import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'
const npxCmd = isWindows ? 'npx.cmd' : 'npx'

console.log('[Dev:All] Memulai server FinNote dan Bot Telegram...')

const bot = spawn('node', ['bot/server.mjs'], { stdio: 'inherit' })
const vite = spawn(npxCmd, ['vite'], { stdio: 'inherit' })

const cleanup = () => {
  bot.kill()
  vite.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
