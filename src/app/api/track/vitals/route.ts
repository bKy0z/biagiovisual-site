import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { name, value, path } = await request.json()
    if (!name || value == null || !path) return NextResponse.json({ ok: false }, { status: 400 })
    await prisma.webVital.create({ data: { name, value: Number(value), path } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
