import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { r2, R2_BUCKET } from '@/lib/r2'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id }  = await params
  const body    = await request.json()

  const allowed = ['category', 'title', 'sortOrder'] as const
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  await prisma.homepagePhoto.update({ where: { id }, data })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params

  const photo = await prisma.homepagePhoto.findUnique({
    where:  { id },
    select: { storageKeyFull: true, storageKeyThumb: true },
  })

  if (!photo) return NextResponse.json({ error: 'Non trovata' }, { status: 404 })

  await prisma.homepagePhoto.delete({ where: { id } })

  await r2.send(new DeleteObjectsCommand({
    Bucket: R2_BUCKET,
    Delete: { Objects: [{ Key: photo.storageKeyFull }, { Key: photo.storageKeyThumb }] },
  })).catch(() => {})

  return NextResponse.json({ success: true })
}
