import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const path: string = body.path ?? '/'
    const referrer: string | null = body.referrer || null

    const ua = request.headers.get('user-agent') ?? ''
    const device = /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop'
    const country = request.headers.get('x-vercel-ip-country') ?? null

    await prisma.pageView.create({ data: { path, referrer, device, country } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
