import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET, downloadFromR2, signedReadUrl } from '@/lib/r2'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { storageKeyFull, storageKeyThumb, contentType, title, category } = await request.json()

  if (!storageKeyFull || !storageKeyThumb || !title || !category) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const original = await downloadFromR2(storageKeyFull)

  const thumb = await sharp(original)
    .resize(1200, undefined, { withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         storageKeyThumb,
    Body:        thumb,
    ContentType: 'image/webp',
  }))

  const photo = await prisma.homepagePhoto.create({
    data: { storageKeyFull, storageKeyThumb, category, title, sortOrder: 0 },
  })

  return NextResponse.json({
    id:       photo.id,
    url:      await signedReadUrl(storageKeyThumb, 3600),
    category: photo.category,
    title:    photo.title,
    date:     photo.createdAt.toISOString(),
  }, { status: 201 })
}
