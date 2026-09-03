export const isValidLogin = (name, pin) => name.trim().length >= 2 && /^\d{4}$/.test(pin)
