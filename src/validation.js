export const isValidLogin = name => name.trim().length >= 2

export const normalizeAmount = value => String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')

export const formatAmountInput = value => normalizeAmount(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')


export const buildDonutStops = (values, total) => {
  if (!total) return ''
  let cursor = 0
  return values.map((value, index) => {
    const start = Number(cursor.toFixed(2))
    cursor += ((Number(value) || 0) / total) * 360
    return `var(--chart-${index + 1}) ${start}deg ${Number(cursor.toFixed(2))}deg`
  }).join(', ')
}

export const isDateInPeriod = (value, period, now = new Date()) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false
  if (period === 'all') return true
  if (period === 'day') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  if (period === 'year') return date.getFullYear() === now.getFullYear()
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return date >= start && date < end
  }
  return false
}

export const amountSizeClass = value => {
  const length = normalizeAmount(Math.abs(Number(value) || 0)).length
  return length >= 13 ? 'amount-long' : length >= 10 ? 'amount-medium' : ''
}

export const calculateBudgetStatus = (spent, limit) => {
  const safeLimit = Number(limit) || 0
  const safeSpent = Number(spent) || 0
  if (safeLimit <= 0) return { percent: 0, remaining: 0, isExceeded: false, isWarning: false, status: 'none' }
  const percent = Math.round((safeSpent / safeLimit) * 100)
  const remaining = safeLimit - safeSpent
  const isExceeded = safeSpent >= safeLimit
  const isWarning = !isExceeded && percent >= 80
  const status = isExceeded ? 'exceeded' : isWarning ? 'warning' : 'safe'
  return { percent, remaining, isExceeded, isWarning, status }
}

export const parseTelegramMessage = (text = '', todayStr = new Date().toISOString().slice(0, 10)) => {
  const clean = text.trim()
  if (!clean || clean.startsWith('/')) return null

  let explicitType = null
  let workText = clean
  if (workText.startsWith('+')) {
    explicitType = 'income'
    workText = workText.slice(1).trim()
  } else if (workText.startsWith('-')) {
    explicitType = 'expense'
    workText = workText.slice(1).trim()
  }

  const amountRegex = /(?:rp\.?\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?))\s*(k|rb|ribu|jt|juta)?\b/i
  const match = workText.match(amountRegex)
  if (!match) return null

  const rawNumStr = match[1]
  const unit = (match[2] || '').toLowerCase()

  let multiplier = 1
  if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
    multiplier = 1000
  } else if (unit === 'jt' || unit === 'juta') {
    multiplier = 1000000
  }

  let baseNum
  if (multiplier > 1) {
    baseNum = parseFloat(rawNumStr.replace(',', '.'))
  } else {
    baseNum = parseInt(rawNumStr.replace(/[.,]/g, ''), 10)
  }

  const amount = Math.round(baseNum * multiplier)
  if (!amount || Number.isNaN(amount) || amount <= 0) return null

  let title = workText.replace(match[0], '').replace(/\s+/g, ' ').replace(/[,\-–—\s]+$/, '').trim()
  if (!title) {
    title = explicitType === 'income' ? 'Pemasukan' : 'Pengeluaran'
  }

  const lowerTitle = title.toLowerCase()
  const incomeRegex = /\b(gaji|salary|upah|bonus|freelance|sidejob|proyek|project|klien|jastip|komisi|dividen|reksadana|investasi|pemasukan)\b/i
  const isIncome = explicitType === 'income' || (!explicitType && incomeRegex.test(lowerTitle))
  const type = isIncome ? 'income' : 'expense'

  let category = 'Lainnya'
  if (type === 'income') {
    if (/\b(gaji|salary|upah|payroll)\b/i.test(lowerTitle)) category = 'Gaji'
    else if (/\b(freelance|proyek|project|klien|sidejob|jastip|komisi)\b/i.test(lowerTitle)) category = 'Freelance'
    else if (/\b(bonus|thr)\b/i.test(lowerTitle)) category = 'Bonus'
    else if (/\b(investasi|dividen|crypto|saham|reksadana)\b/i.test(lowerTitle)) category = 'Investasi'
    else category = 'Lainnya'
  } else {
    if (/\b(nonton|bioskop|cinema|xxi|game|topup|steam|playstation|liburan|rekreasi|wisata|karaoke)\b/i.test(lowerTitle)) {
      category = 'Hiburan'
    } else if (/\b(tagihan|bayar|pln|listrik|air|pdam|wifi|indihome|firstmedia|biznet|pulsa|kuota|telkomsel|xl|indosat|iuran|bpjs|kos|kost|sewa|kontrakan|cicilan|spotify|netflix)\b/i.test(lowerTitle)) {
      category = 'Tagihan'
    } else if (/\b(bensin|pertalite|pertamax|solar|spbu|ojek|grab|gojek|maxim|parkir|tol|krl|mrt|lrt|tj|busway|angkot|tiket|kereta|travel|servis|ban)\b/i.test(lowerTitle)) {
      category = 'Transportasi'
    } else if (/\b(beli|belanja|shopee|tokped|tokopedia|tiktok|lazada|mall|baju|kaos|celana|jaket|sepatu|sandal|skincare|sabun|sampo|indomaret|alfamart|minimarket)\b/i.test(lowerTitle)) {
      category = 'Belanja'
    } else if (/\b(makan|minum|kopi|cafe|resto|gofood|grabfood|shopeefood|jajan|snack|roti|mie|bakso|nasi|ayam|teh|boba|sarapan|lunch|dinner|warteg)\b/i.test(lowerTitle)) {
      category = 'Makan & Minum'
    } else {
      category = 'Lainnya'
    }
  }

  const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

  return {
    type,
    amount,
    title: capitalizedTitle,
    category,
    date: todayStr,
    note: 'Dicatat via Telegram Bot'
  }
}
