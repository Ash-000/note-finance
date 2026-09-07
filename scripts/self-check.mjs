import assert from 'node:assert/strict'
import { amountSizeClass, buildDonutStops, calculateBudgetStatus, formatAmountInput, isDateInPeriod, isValidLogin, normalizeAmount } from '../src/validation.js'

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

console.log('Self-check passed')

