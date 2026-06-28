import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/slug'

// GET — lista tutte le gallerie (admin only)
export async function GET() {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const galleries = await prisma.gallery.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id:              true,
      slug:            true,
      title:           true,
      downloadEnabled: true,
      coverPhotoId:    true,
      expiresAt:       true,
      createdAt:       true,
      _count: { select: { photos: true } },
    },
  })

  return NextResponse.json(galleries)
}

// POST — crea nuova galleria
export async function POST(request: NextRequest) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let body: { title?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const { title, password } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password minimo 6 caratteri' }, { status: 400 })
  }

  const slug         = generateSlug()
  const passwordHash = await bcrypt.hash(password, 12)
  const expiresAt    = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // +90 giorni

  const gallery = await prisma.gallery.create({
    data: { slug, title: title.trim(), passwordHash, expiresAt },
  })

  return NextResponse.json({ ...gallery, _count: { photos: 0 } }, { status: 201 })
}
