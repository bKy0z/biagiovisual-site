import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { prisma } from '@/lib/prisma'
import { getAdminSession, getGallerySession } from '@/lib/session'
import { downloadFromR2 } from '@/lib/r2'

export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: {
      id:              true,
      title:           true,
      downloadEnabled: true,
      expiresAt:       true,
    },
  })

  if (!gallery) return NextResponse.json({ error: 'Non trovata' }, { status: 404 })
  if (!gallery.downloadEnabled) return NextResponse.json({ error: 'Download disabilitato' }, { status: 403 })
  if (gallery.expiresAt < new Date()) return NextResponse.json({ error: 'Galleria scaduta' }, { status: 410 })

  const admin   = await getAdminSession()
  const session = admin ? { galleryId: gallery.id } : await getGallerySession(gallery.id)
  if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const photos = await prisma.photo.findMany({
    where:   { galleryId: gallery.id },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, storageKeyFull: true, filename: true },
  })

  if (photos.length === 0) return NextResponse.json({ error: 'Nessuna foto' }, { status: 404 })

  // Log download "scarica tutte"
  await prisma.downloadLog.create({ data: { galleryId: gallery.id, photoId: null } })

  // Crea zip in streaming
  const pass    = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 5 } })
  archive.pipe(pass)

  // Scarica ogni foto da R2 e aggiungila allo zip
  ;(async () => {
    const seen = new Set<string>()
    for (const photo of photos) {
      try {
        const buf = await downloadFromR2(photo.storageKeyFull)
        // Deduplica filename se necessario
        let name = photo.filename
        if (seen.has(name)) {
          const ext   = name.includes('.') ? '.' + name.split('.').pop() : ''
          const base  = name.slice(0, name.length - ext.length)
          let counter = 1
          while (seen.has(`${base}_${counter}${ext}`)) counter++
          name = `${base}_${counter}${ext}`
        }
        seen.add(name)
        archive.append(buf, { name })
      } catch {
        // Foto non accessibile: salta senza bloccare lo zip
      }
    }
    await archive.finalize()
  })()

  // Converti PassThrough Node.js → Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      pass.on('data',  chunk => controller.enqueue(new Uint8Array(chunk)))
      pass.on('end',   ()    => controller.close())
      pass.on('error', err   => controller.error(err))
    },
    cancel() { archive.abort() },
  })

  const safeName = gallery.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'galleria'

  return new Response(webStream, {
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`,
      'Cache-Control':       'no-store',
    },
  })
}
