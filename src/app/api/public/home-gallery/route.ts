import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signedReadUrl } from '@/lib/r2'

export const dynamic = 'force-dynamic'

export async function GET() {
  const photos = await prisma.homepagePhoto.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  const result = await Promise.all(
    photos.map(async p => ({
      id:       p.id,
      url:      await signedReadUrl(p.storageKeyThumb, 3600),
      category: p.category,
      title:    p.title,
      date:     p.createdAt.toISOString(),
    })),
  )

  return NextResponse.json({ photos: result })
}
