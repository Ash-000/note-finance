export const isValidLogin = (name, pin) => name.trim().length >= 2 && /^\d{4}$/.test(pin)

export const normalizeAmount = value => String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')

export const formatAmountInput = value => normalizeAmount(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const amountSizeClass = value => {
  const length = normalizeAmount(Math.abs(Number(value) || 0)).length
  return length >= 13 ? 'amount-long' : length >= 10 ? 'amount-medium' : ''
}
