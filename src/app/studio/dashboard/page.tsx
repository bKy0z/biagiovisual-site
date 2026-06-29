import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { signedReadUrl } from '@/lib/r2'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title:  'Dashboard — Biagio Visconti',
  robots: 'noindex',
}

export default async function DashboardPage() {
  if (!await getAdminSession()) redirect('/studio')

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week  = new Date(today); week.setDate(today.getDate() - 6)
  const month = new Date(today); month.setDate(today.getDate() - 29)

  const [galleries, todayCount, weekCount, monthCount, allViews, devices, vitalsRaw] = await Promise.all([
    prisma.gallery.findMany({
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
    }),
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    prisma.pageView.count({ where: { createdAt: { gte: week } } }),
    prisma.pageView.count({ where: { createdAt: { gte: month } } }),
    prisma.pageView.findMany({
      where:   { createdAt: { gte: month } },
      select:  { createdAt: true, path: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pageView.groupBy({
      by:     ['device'],
      where:  { createdAt: { gte: month } },
      _count: { _all: true },
    }),
    prisma.webVital.findMany({
      where:  { name: 'LCP', createdAt: { gte: week } },
      select: { value: true },
    }),
  ])

  // Giornaliero ultimi 30gg
  const dayMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    dayMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const v of allViews) {
    const key = v.createdAt.toISOString().slice(0, 10)
    if (key in dayMap) dayMap[key]++
  }
  const dailyViews = Object.entries(dayMap).map(([date, views]) => ({
    date: date.slice(5), // "MM-DD"
    views,
  }))

  // Top pagine
  const pageMap: Record<string, number> = {}
  for (const v of allViews) pageMap[v.path] = (pageMap[v.path] ?? 0) + 1
  const topPages = Object.entries(pageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, views]) => ({ path, views }))

  // Device split
  const deviceMap: Record<string, number> = { mobile: 0, desktop: 0 }
  for (const d of devices) deviceMap[d.device ?? 'desktop'] = (deviceMap[d.device ?? 'desktop'] ?? 0) + d._count._all

  // LCP medio
  const avgLcp = vitalsRaw.length > 0
    ? Math.round(vitalsRaw.reduce((s, v) => s + v.value, 0) / vitalsRaw.length)
    : null

  // Copertine gallerie
  const coverIds = galleries.map(g => g.coverPhotoId).filter(Boolean) as string[]
  const coverPhotos = coverIds.length > 0
    ? await prisma.photo.findMany({ where: { id: { in: coverIds } }, select: { id: true, storageKeyThumb: true } })
    : []
  const thumbUrlMap: Record<string, string> = {}
  await Promise.all(coverPhotos.map(async p => { thumbUrlMap[p.id] = await signedReadUrl(p.storageKeyThumb, 3600) }))

  return (
    <DashboardClient
      galleries={galleries.map(g => ({
        ...g,
        coverThumbUrl: g.coverPhotoId ? (thumbUrlMap[g.coverPhotoId] ?? null) : null,
        expiresAt: g.expiresAt.toISOString(),
        createdAt: g.createdAt.toISOString(),
      }))}
      analytics={{
        today:      todayCount,
        week:       weekCount,
        month:      monthCount,
        dailyViews,
        topPages,
        devices:    deviceMap,
        lcp:        avgLcp,
        lcpSamples: vitalsRaw.length,
      }}
    />
  )
}
