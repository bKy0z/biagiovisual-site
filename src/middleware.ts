import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Verifica inline del token admin — non importa session.ts per evitare
// conflitti con next/headers che non è disponibile nell'Edge Runtime del middleware
const COOKIE_ADMIN = 'bv_admin'
const getSecret = () => new TextEncoder().encode(process.env.SESSION_SECRET!)

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_ADMIN)?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rewrite "/" → sito statico esistente
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/index.html', request.url))
  }

  // Proteggi tutte le route admin tranne /studio (pagina di login)
  if (pathname.startsWith('/studio/')) {
    if (!await isAdmin(request)) {
      return NextResponse.redirect(new URL('/studio', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/studio/:path+',  // /studio/dashboard, /studio/galleria/[id] — non /studio stesso
    '/galleria/:path*',
  ],
}
