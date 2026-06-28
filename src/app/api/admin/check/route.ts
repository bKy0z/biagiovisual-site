import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/session'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ authenticated: false })

  const exp       = typeof session.exp === 'number' ? session.exp : 0
  const expiresIn = Math.max(0, exp - Math.floor(Date.now() / 1000))
  const expiresAt = exp * 1000

  return NextResponse.json({ authenticated: true, expiresIn, expiresAt })
}
