import assert from 'node:assert/strict'
import { isValidLogin } from '../src/validation.js'

assert.equal(isValidLogin('Raka', '1234'), true)
assert.equal(isValidLogin('R', '1234'), false)
assert.equal(isValidLogin('Raka', '12ab'), false)
assert.equal(isValidLogin('Raka', '12345'), false)

console.log('Self-check passed')
