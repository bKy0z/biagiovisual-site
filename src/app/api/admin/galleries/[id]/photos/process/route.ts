import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET, downloadFromR2, signedReadUrl } from '@/lib/r2'

// Timeout esteso per il download da R2 + elaborazione sharp + upload thumbnail
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

/**
 * POST — Elabora una foto già caricata su R2:
 * 1. Scarica l'originale da R2
 * 2. Genera anteprima con sharp (max 1200px, WebP qualità 82)
 * 3. Carica l'anteprima su R2
 * 4. Crea il record Photo nel DB
 * 5. Restituisce la foto con URL firmato per l'anteprima
 */
export async function POST(request: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id: galleryId } = await params

  const gallery = await prisma.gallery.findUnique({
    where:  { id: galleryId },
    select: { id: true },
  })
  if (!gallery) {
    return NextResponse.json({ error: 'Galleria non trovata' }, { status: 404 })
  }

  let body: {
    storageKeyFull?:  string
    storageKeyThumb?: string
    filename?:        string
    contentType?:     string
    size?:            number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
  }

  const { storageKeyFull, storageKeyThumb, filename, size } = body
  if (!storageKeyFull || !storageKeyThumb || !filename) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  // Scarica l'originale da R2 per generare l'anteprima
  const buffer = await downloadFromR2(storageKeyFull)

  // Metadati immagine (larghezza, altezza)
  const meta = await sharp(buffer).metadata()

  // Genera anteprima: max 1200px larghezza, formato WebP, qualità 82
  const thumbBuffer = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  // Carica l'anteprima su R2
  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         storageKeyThumb,
    Body:        thumbBuffer,
    ContentType: 'image/webp',
  }))

  // Conta le foto esistenti per assegnare l'ordine di visualizzazione
  const sortOrder = await prisma.photo.count({ where: { galleryId } })

  // Crea il record nel database
  const photo = await prisma.photo.create({
    data: {
      galleryId,
      storageKeyFull,
      storageKeyThumb,
      filename,
      width:     meta.width  ?? null,
      height:    meta.height ?? null,
      sizeBytes: size != null ? BigInt(size) : null,
      sortOrder,
    },
  })

  // URL firmato dell'anteprima per la visualizzazione immediata nel pannello
  const thumbUrl = await signedReadUrl(storageKeyThumb, 3600)

  return NextResponse.json({
    ...photo,
    sizeBytes: photo.sizeBytes?.toString() ?? null,
    thumbUrl,
  }, { status: 201 })
}
