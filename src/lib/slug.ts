import { randomBytes } from 'crypto'

/**
 * Genera uno slug casuale URL-safe per l'URL della galleria cliente.
 * 18 byte → 24 caratteri base64url (A-Z, a-z, 0-9, -, _).
 * Spazio di ricerca: 64^24 ≈ 2^144 — non indovinabile con brute-force.
 */
export function generateSlug(): string {
  return randomBytes(18).toString('base64url')
}
