import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { signedReadUrl } from '@/lib/r2'
import DashboardClient from './DashboardClient'

export const metadata = {
  title:  'Dashboard — Biagiovisuals Studio',
  robots: 'noindex',
}

export default async function DashboardPage() {
  if (!await getAdminSession()) redirect('/studio')

  const galleries = await prisma.gallery.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id:           true,
      slug:         true,
      title:        true,
      coverPhotoId: true,
      expiresAt:    true,
      createdAt:    true,
      _count: { select: { photos: true } },
    },
  })

  // Recupera le chiavi thumbnail per le foto copertina
  const coverIds = galleries.map(g => g.coverPhotoId).filter(Boolean) as string[]
  const coverPhotos = coverIds.length > 0
    ? await prisma.photo.findMany({
        where: { id: { in: coverIds } },
        select: { id: true, storageKeyThumb: true },
      })
    : []

  const thumbUrlMap: Record<string, string> = {}
  await Promise.all(
    coverPhotos.map(async p => {
      thumbUrlMap[p.id] = await signedReadUrl(p.storageKeyThumb, 3600)
    }),
  )

  // Serializza Date → string per il passaggio al Client Component
  const data = galleries.map(g => ({
    ...g,
    coverThumbUrl: g.coverPhotoId ? (thumbUrlMap[g.coverPhotoId] ?? null) : null,
    expiresAt: g.expiresAt.toISOString(),
    createdAt: g.createdAt.toISOString(),
  }))

  return <DashboardClient galleries={data} />
}
