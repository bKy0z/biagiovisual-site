import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signGalleryToken, COOKIE_GALLERY, cookieOpts } from '@/lib/session'
import { checkLoginRateLimit, resetLoginRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'localhost'
  const key = `gallery:${ip}:${slug}`

  const { allowed, retryAfter } = checkLoginRateLimit(key)
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

  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: { id: true, passwordHash: true, expiresAt: true },
  })

  if (!gallery) {
    return NextResponse.json({ error: 'Galleria non trovata' }, { status: 404 })
  }

  if (!gallery.passwordHash) {
    return NextResponse.json({ error: 'Galleria senza password' }, { status: 400 })
  }
  const valid = await bcrypt.compare(password, gallery.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Password errata' }, { status: 401 })
  }

  resetLoginRateLimit(key)
  const token = await signGalleryToken(gallery.id)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_GALLERY, token, cookieOpts)
  return res
}
