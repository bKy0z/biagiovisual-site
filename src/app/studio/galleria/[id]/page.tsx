import { redirect, notFound } from 'next/navigation'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { signedReadUrl } from '@/lib/r2'
import GalleryManager from './GalleryManager'

export const metadata = {
  title:  'Gestione galleria — Biagio Visconti',
  robots: 'noindex',
}

type Props = { params: Promise<{ id: string }> }

export default async function GalleryAdminPage({ params }: Props) {
  if (!await getAdminSession()) redirect('/studio')

  const { id } = await params

  const gallery = await prisma.gallery.findUnique({
    where:   { id },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!gallery) notFound()

  // Genera URL firmati per le anteprime (1 ora — solo per uso admin)
  const photosWithUrls = await Promise.all(
    gallery.photos.map(async p => ({
      id:             p.id,
      filename:       p.filename,
      storageKeyFull: p.storageKeyFull,
      width:          p.width,
      height:         p.height,
      sizeBytes:      p.sizeBytes?.toString() ?? null,
      sortOrder:      p.sortOrder,
      thumbUrl:       await signedReadUrl(p.storageKeyThumb, 3600),
    })),
  )

  const galleryData = {
    id:              gallery.id,
    slug:            gallery.slug,
    title:           gallery.title,
    downloadEnabled: gallery.downloadEnabled,
    coverPhotoId:    gallery.coverPhotoId,
    expiresAt:       gallery.expiresAt.toISOString(),
    createdAt:       gallery.createdAt.toISOString(),
  }

  return <GalleryManager gallery={galleryData} initialPhotos={photosWithUrls} />
}
