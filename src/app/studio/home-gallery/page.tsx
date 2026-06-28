import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { signedReadUrl } from '@/lib/r2'
import HomeGalleryManager from './HomeGalleryManager'

export const dynamic = 'force-dynamic'

export default async function HomeGalleryPage() {
  const session = await getAdminSession()
  if (!session) redirect('/studio')

  const photos = await prisma.homepagePhoto.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  const initialPhotos = await Promise.all(
    photos.map(async p => ({
      id:       p.id,
      url:      await signedReadUrl(p.storageKeyThumb, 3600),
      category: p.category,
      title:    p.title,
      date:     p.createdAt.toISOString(),
    })),
  )

  return <HomeGalleryManager initialPhotos={initialPhotos} />
}
