import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAdminSession, getGallerySession } from '@/lib/session'
import { signedReadUrl } from '@/lib/r2'
import PasswordForm from './PasswordForm'
import GalleryView from './GalleryView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: { title: true },
  })
  return {
    title: gallery ? `${gallery.title} — Biagio Visconti` : 'Galleria — Biagio Visconti',
    robots: 'noindex',
  }
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: {
      id:              true,
      title:           true,
      downloadEnabled: true,
      expiresAt:       true,
      coverPhotoId:    true,
      passwordHash:    true,
    },
  })

  if (!gallery) notFound()

  const expired = gallery.expiresAt < new Date()

  // Admin bypass: se ha sessione admin può vedere la galleria senza password
  const admin   = await getAdminSession()
  // Se la galleria non ha password, accesso diretto senza sessione
  const noPassword = gallery.passwordHash === null
  const session = admin || noPassword ? { galleryId: gallery.id } : await getGallerySession(gallery.id)

  if (!session) {
    return <PasswordForm slug={slug} title={gallery.title} expired={expired} />
  }

  if (expired) {
    return <ExpiredPage title={gallery.title} />
  }

  const photos = await prisma.photo.findMany({
    where:   { galleryId: gallery.id },
    orderBy: { sortOrder: 'asc' },
    select:  {
      id:              true,
      storageKeyThumb: true,
      storageKeyFull:  true,
      filename:        true,
      width:           true,
      height:          true,
    },
  })

  const photosWithUrls = await Promise.all(
    photos.map(async p => ({
      id:       p.id,
      filename: p.filename,
      width:    p.width,
      height:   p.height,
      thumbUrl: await signedReadUrl(p.storageKeyThumb, 3600),
      fullUrl:  await signedReadUrl(p.storageKeyFull, 3600),
    })),
  )

  // Cover: foto impostata come copertina, oppure prima foto della galleria
  const coverPhoto = gallery.coverPhotoId
    ? photos.find(p => p.id === gallery.coverPhotoId) ?? photos[0]
    : photos[0]
  const coverUrl = coverPhoto ? await signedReadUrl(coverPhoto.storageKeyFull, 3600) : null

  return (
    <GalleryView
      slug={slug}
      title={gallery.title}
      photos={photosWithUrls}
      coverUrl={coverUrl}
      downloadEnabled={gallery.downloadEnabled}
    />
  )
}

function ExpiredPage({ title }: { title: string }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#080808', color: '#e8e0d4',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: '20px', textAlign: 'center',
    }}>
      <p style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', fontSize: '1rem', letterSpacing: '0.08em', marginBottom: '40px' }}>
        Biagiovisuals
      </p>
      <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#e8e0d4', fontSize: '1.5rem', marginBottom: '12px' }}>
        {title}
      </h1>
      <p style={{ color: 'rgba(232,224,212,0.4)', fontSize: '0.9rem' }}>
        Questa galleria è scaduta.
      </p>
      <p style={{ color: 'rgba(232,224,212,0.25)', fontSize: '0.82rem', marginTop: '8px' }}>
        Contatta il fotografo per ulteriori informazioni.
      </p>
    </div>
  )
}
