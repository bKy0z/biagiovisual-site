import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { signedPutUrl, r2KeyFull, r2KeyThumb } from '@/lib/r2'

type Params = { params: Promise<{ id: string }> }

/**
 * POST — Prepara l'upload di una foto.
 * Restituisce un URL firmato per il caricamento DIRETTO dal browser a R2.
 * Questo evita il passaggio del file attraverso Vercel (nessun limite di dimensione).
 */
export async function POST(request: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id: galleryId } = await params

  const gallery = await prisma.gallery.findUnique({
    where:  { id: galleryId },
    select: { slug: true },
  })
  if (!gallery) {
    return NextResponse.json({ error: 'Galleria non trovata' }, { status: 404 })
  }

  let body: { filename?: string; contentType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const { filename, contentType } = body
  if (!filename || !contentType?.startsWith('image/')) {
    return NextResponse.json({ error: 'filename e contentType immagine richiesti' }, { status: 400 })
  }

  const uuid = randomUUID()
  const ext  = filename.split('.').pop()?.toLowerCase() ?? 'jpg'

  const storageKeyFull  = r2KeyFull(gallery.slug, uuid, ext)
  const storageKeyThumb = r2KeyThumb(gallery.slug, uuid)

  // URL firmato PUT per l'upload diretto dal browser (15 min di validità)
  const uploadUrl = await signedPutUrl(storageKeyFull, contentType, 900)

  return NextResponse.json({ uploadUrl, storageKeyFull, storageKeyThumb, uuid })
}
