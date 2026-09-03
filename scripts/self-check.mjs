import assert from 'node:assert/strict'
import { amountSizeClass, formatAmountInput, isValidLogin, normalizeAmount, normalizeTheme } from '../src/validation.js'

assert.equal(isValidLogin('Raka', '1234'), true)
assert.equal(isValidLogin('R', '1234'), false)
assert.equal(isValidLogin('Raka', '12ab'), false)
assert.equal(isValidLogin('Raka', '12345'), false)
assert.equal(normalizeAmount('Rp 001.250.000'), '1250000')
assert.equal(formatAmountInput('1250000'), '1.250.000')
assert.equal(formatAmountInput(''), '')
assert.equal(amountSizeClass(999999999), '')
assert.equal(amountSizeClass(1000000000), 'amount-medium')
assert.equal(amountSizeClass(1000000000000), 'amount-long')
assert.equal(normalizeTheme('cool-grey'), 'cool-grey')
assert.equal(normalizeTheme('deep-ocean'), 'deep-ocean')
assert.equal(normalizeTheme('dark'), 'deep-ocean')

console.log('Self-check passed')
