/**
 * Client-side security helpers.
 *
 * IMPORTANT: actual PIN hashing happens server-side in PL/pgSQL using
 * `extensions.crypt()` + `extensions.gen_salt('bf', 8)` (see
 * `database/procedures.sql`). Never hash or store PINs in the browser.
 */

/** Strip whitespace and only allow 4 digits. */
export function sanitizePin(input: string): string {
  return input.replace(/\D/g, "").slice(0, 4);
}

/** Remove any character that is not safe in a reference / description. */
export function sanitizeText(input: string, maxLen = 120): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

/** Constant-time string comparison (use for any client-side token check). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}