import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signAdminToken, COOKIE_ADMIN, cookieOpts } from '@/lib/session'
import { checkLoginRateLimit, resetLoginRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // IP per rate limiting (x-forwarded-for su Vercel, ::1 in locale)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'localhost'

  const { allowed, retryAfter } = checkLoginRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: `Troppi tentativi. Riprova tra ${retryAfter} secondi.` },
      { status: 429 },
    )
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const { password } = body
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password richiesta' }, { status: 400 })
  }

  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) {
    console.error('[BV] ADMIN_PASSWORD_HASH non configurato')
    return NextResponse.json({ error: 'Errore di configurazione server' }, { status: 500 })
  }

  const valid = await bcrypt.compare(password, hash)
  if (!valid) {
    return NextResponse.json({ error: 'Password errata' }, { status: 401 })
  }

  // Login riuscito: azzera rate limit e imposta cookie sessione
  resetLoginRateLimit(ip)
  const token = await signAdminToken()

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_ADMIN, token, cookieOpts)
  return res
}
