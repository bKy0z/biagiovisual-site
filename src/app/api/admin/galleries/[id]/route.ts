import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET, signedReadUrl } from '@/lib/r2'

type Params = { params: Promise<{ id: string }> }

// GET — dettaglio galleria con foto e URL firmati per le anteprime
export async function GET(_req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params

  const gallery = await prisma.gallery.findUnique({
    where:   { id },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!gallery) {
    return NextResponse.json({ error: 'Galleria non trovata' }, { status: 404 })
  }

  // Genera URL firmati per le anteprime (1 ora — solo per il pannello admin)
  const photosWithUrls = await Promise.all(
    gallery.photos.map(async (p) => ({
      ...p,
      sizeBytes: p.sizeBytes?.toString() ?? null,
      thumbUrl:  await signedReadUrl(p.storageKeyThumb, 3600),
    })),
  )

  return NextResponse.json({ ...gallery, photos: photosWithUrls })
}

// PATCH — aggiorna titolo, downloadEnabled, coverPhotoId
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params
  const body: Record<string, unknown> = await request.json()

  // Whitelist dei campi modificabili
  const allowed = ['title', 'downloadEnabled', 'coverPhotoId', 'expiresAt'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const gallery = await prisma.gallery.update({ where: { id }, data })
  return NextResponse.json(gallery)
}

// DELETE — elimina galleria (le foto su R2 vengono rimosse in Fase 5)
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params

  // Raccoglie le chiavi R2 di tutte le foto prima di eliminare dal DB
  const photos = await prisma.photo.findMany({
    where:  { galleryId: id },
    select: { storageKeyFull: true, storageKeyThumb: true },
  })

  // Il cascade Prisma elimina tutte le Photo associate
  await prisma.gallery.delete({ where: { id } })

  // Pulizia R2: elimina originali + thumbnail in batch (max 1000 per richiesta)
  if (photos.length > 0) {
    const keys = photos.flatMap(p => [
      { Key: p.storageKeyFull },
      { Key: p.storageKeyThumb },
    ])
    for (let i = 0; i < keys.length; i += 1000) {
      await r2.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: keys.slice(i, i + 1000) },
      })).catch(() => { /* ignora errori R2 — il DB è già pulito */ })
    }
  }

  return NextResponse.json({ ok: true })
}
