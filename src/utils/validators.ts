/** Exactly 4 decimal digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Positive number with at most 2 decimal places. */
export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) === amount * 100;
}

/** Nigerian-style 10-11 digit phone number (very loose). */
export function isValidPhone(phone: string): boolean {
  return /^(\+?234|0)\d{10}$/.test(phone.replace(/\s+/g, ""));
}

/** Basic email check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** VMB account number format produced by the set_account_number trigger. */
export function isValidAccountNumber(accountNumber: string): boolean {
  return /^VMB\d{10}$/.test(accountNumber);
}