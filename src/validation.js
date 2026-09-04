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
