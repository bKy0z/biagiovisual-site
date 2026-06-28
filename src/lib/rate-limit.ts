// Rate limiting in memoria per il login admin.
// Si azzera al riavvio del server — accettabile per un pannello personale.
// Per un uso multi-istanza (Vercel Pro con più regioni) usare Upstash Redis.

const attempts = new Map<string, { count: number; expiresAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS    = 15 * 60 * 1000 // 15 minuti

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const rec = attempts.get(ip)

  if (!rec || now > rec.expiresAt) {
    attempts.set(ip, { count: 1, expiresAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (rec.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((rec.expiresAt - now) / 1000) }
  }

  rec.count++
  return { allowed: true }
}

export function resetLoginRateLimit(ip: string) {
  attempts.delete(ip)
}
