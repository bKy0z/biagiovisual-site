import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET } from '@/lib/r2'

type Params = { params: Promise<{ id: string; photoId: string }> }

// DELETE — elimina singola foto da R2 e dal DB
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id: galleryId, photoId } = await params

  // Verifica che la foto appartenga alla galleria (nessun IDOR)
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, galleryId },
  })
  if (!photo) {
    return NextResponse.json({ error: 'Foto non trovata' }, { status: 404 })
  }

  // Elimina i file da R2
  await Promise.all([
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: photo.storageKeyFull })),
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: photo.storageKeyThumb })),
  ])

  // Elimina dal DB
  await prisma.photo.delete({ where: { id: photoId } })

  return NextResponse.json({ ok: true })
}
