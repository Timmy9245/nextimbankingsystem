/** Format a number as Naira currency. */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 2,
  }).format(amount);
}

/** Format a timestamp as a short human-readable date+time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    dateStyle: "medium", timeStyle: "short",
  });
}

/** Mask all but the last 4 digits of an account number. */
export function maskAccount(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return "•".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}