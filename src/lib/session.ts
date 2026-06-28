import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const getSecret = () => new TextEncoder().encode(process.env.SESSION_SECRET!)

export const COOKIE_ADMIN   = 'bv_admin'
export const COOKIE_GALLERY = 'bv_gallery'
const SESSION_TTL = 60 * 60 * 8 // 8 ore

export const cookieOpts = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path:     '/',
  maxAge:   SESSION_TTL,
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())
}

/** Legge e verifica la sessione admin dai cookie (Server Component / Route Handler). */
export async function getAdminSession() {
  const store = await cookies()
  const token = store.get(COOKIE_ADMIN)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'admin' ? payload : null
  } catch {
    return null
  }
}

// ─── Client galleria ──────────────────────────────────────────────────────────

export async function signGalleryToken(galleryId: string): Promise<string> {
  return new SignJWT({ role: 'client', galleryId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())
}

/**
 * Verifica il cookie galleria e controlla che corrisponda ESATTAMENTE alla galleria richiesta.
 * Un token valido per la galleria A non dà accesso alla galleria B.
 */
export async function getGallerySession(galleryId: string) {
  const store = await cookies()
  const token = store.get(COOKIE_GALLERY)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (
      payload.role === 'client' &&
      typeof payload.galleryId === 'string' &&
      payload.galleryId === galleryId
    ) {
      return { galleryId: payload.galleryId }
    }
    return null
  } catch {
    return null
  }
}
