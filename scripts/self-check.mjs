import assert from 'node:assert/strict'
import { amountSizeClass, buildDonutStops, calculateBudgetStatus, formatAmountInput, isDateInPeriod, isValidLogin, normalizeAmount, parseTelegramMessage } from '../src/validation.js'

assert.equal(isValidLogin('Raka'), true)
assert.equal(isValidLogin('R'), false)
assert.equal(normalizeAmount('Rp 001.250.000'), '1250000')
assert.equal(formatAmountInput('1250000'), '1.250.000')
assert.equal(formatAmountInput(''), '')
assert.equal(amountSizeClass(999999999), '')
assert.equal(amountSizeClass(1000000000), 'amount-medium')
assert.equal(amountSizeClass(1000000000000), 'amount-long')

assert.equal(buildDonutStops([75, 25], 100), 'var(--chart-1) 0deg 270deg, var(--chart-2) 270deg 360deg')
assert.equal(buildDonutStops([], 0), '')
const referenceDate = new Date('2026-09-03T12:00:00')
assert.equal(isDateInPeriod('2026-09-03', 'day', referenceDate), true)
assert.equal(isDateInPeriod('2026-09-02', 'day', referenceDate), false)
assert.equal(isDateInPeriod('2026-08-31', 'week', referenceDate), true)
assert.equal(isDateInPeriod('2026-09-07', 'week', referenceDate), false)
assert.equal(isDateInPeriod('2026-09-01', 'month', referenceDate), true)
assert.equal(isDateInPeriod('2026-08-31', 'month', referenceDate), false)
assert.equal(isDateInPeriod('2026-01-01', 'year', referenceDate), true)
assert.equal(isDateInPeriod('2025-12-31', 'year', referenceDate), false)
assert.equal(isDateInPeriod('2025-12-31', 'all', referenceDate), true)

// Budget calculation assertions
assert.deepEqual(calculateBudgetStatus(0, 0), { percent: 0, remaining: 0, isExceeded: false, isWarning: false, status: 'none' })
assert.deepEqual(calculateBudgetStatus(500000, 2000000), { percent: 25, remaining: 1500000, isExceeded: false, isWarning: false, status: 'safe' })
assert.deepEqual(calculateBudgetStatus(1700000, 2000000), { percent: 85, remaining: 300000, isExceeded: false, isWarning: true, status: 'warning' })
assert.deepEqual(calculateBudgetStatus(2100000, 2000000), { percent: 105, remaining: -100000, isExceeded: true, isWarning: false, status: 'exceeded' })

// Telegram message parsing assertions
const msgExpense1 = parseTelegramMessage('kopi 25k', '2026-09-16')
assert.equal(msgExpense1?.amount, 25000)
assert.equal(msgExpense1?.category, 'Makan & Minum')
assert.equal(msgExpense1?.type, 'expense')
assert.equal(msgExpense1?.title, 'Kopi')

const msgExpense2 = parseTelegramMessage('bensin pertalite 50rb', '2026-09-16')
assert.equal(msgExpense2?.amount, 50000)
assert.equal(msgExpense2?.category, 'Transportasi')
assert.equal(msgExpense2?.type, 'expense')

const msgExpense3 = parseTelegramMessage('makan siang 35.000', '2026-09-16')
assert.equal(msgExpense3?.amount, 35000)
assert.equal(msgExpense3?.category, 'Makan & Minum')

const msgIncome1 = parseTelegramMessage('gaji bulanan 5.000.000', '2026-09-16')
assert.equal(msgIncome1?.amount, 5000000)
assert.equal(msgIncome1?.category, 'Gaji')
assert.equal(msgIncome1?.type, 'income')

const msgIncome2 = parseTelegramMessage('+1.5jt freelance web', '2026-09-16')
assert.equal(msgIncome2?.amount, 1500000)
assert.equal(msgIncome2?.category, 'Freelance')
assert.equal(msgIncome2?.type, 'income')

const msgBelanja = parseTelegramMessage('beli baju distro 150000', '2026-09-16')
assert.equal(msgBelanja?.amount, 150000)
assert.equal(msgBelanja?.category, 'Belanja')
assert.equal(msgBelanja?.type, 'expense')

const msgTagihan = parseTelegramMessage('bayar listrik token 120.000', '2026-09-16')
assert.equal(msgTagihan?.amount, 120000)
assert.equal(msgTagihan?.category, 'Tagihan')

const msgHiburan = parseTelegramMessage('nonton bioskop premiere 80rb', '2026-09-16')
assert.equal(msgHiburan?.amount, 80000)
assert.equal(msgHiburan?.category, 'Hiburan')

const msgBonus = parseTelegramMessage('bonus lembur 350k', '2026-09-16')
assert.equal(msgBonus?.amount, 350000)
assert.equal(msgBonus?.category, 'Bonus')
assert.equal(msgBonus?.type, 'income')

assert.equal(parseTelegramMessage('/start'), null)
assert.equal(parseTelegramMessage('hanya teks tanpa nominal'), null)
assert.equal(parseTelegramMessage(''), null)

console.log('Self-check passed')


