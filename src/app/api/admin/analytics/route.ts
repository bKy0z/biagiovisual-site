import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const now    = new Date()
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week   = new Date(today); week.setDate(today.getDate() - 6)
  const month  = new Date(today); month.setDate(today.getDate() - 29)

  const [todayCount, weekCount, monthCount, allViews, devices, vitalsRaw] = await Promise.all([
    // Visite oggi
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    // Visite ultima settimana
    prisma.pageView.count({ where: { createdAt: { gte: week } } }),
    // Visite ultimi 30 giorni
    prisma.pageView.count({ where: { createdAt: { gte: month } } }),
    // Tutte le visite degli ultimi 30 giorni (per raggruppare per giorno)
    prisma.pageView.findMany({
      where:   { createdAt: { gte: month } },
      select:  { createdAt: true, path: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Split mobile/desktop
    prisma.pageView.groupBy({
      by:     ['device'],
      where:  { createdAt: { gte: month } },
      _count: { _all: true },
    }),
    // Web Vitals LCP ultimi 7 giorni
    prisma.webVital.findMany({
      where:  { name: 'LCP', createdAt: { gte: week } },
      select: { value: true },
    }),
  ])

  // Raggruppa per giorno (ultimi 30gg)
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
  const dailyViews = Object.entries(dayMap).map(([date, views]) => ({ date, views }))

  // Top 5 pagine
  const pageMap: Record<string, number> = {}
  for (const v of allViews) {
    pageMap[v.path] = (pageMap[v.path] ?? 0) + 1
  }
  const topPages = Object.entries(pageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, views]) => ({ path, views }))

  // Device split
  const deviceMap: Record<string, number> = { mobile: 0, desktop: 0 }
  for (const d of devices) deviceMap[d.device ?? 'desktop'] = (deviceMap[d.device ?? 'desktop'] ?? 0) + d._count._all

  // LCP medio (ms → s)
  const avgLcp = vitalsRaw.length > 0
    ? vitalsRaw.reduce((sum, v) => sum + v.value, 0) / vitalsRaw.length
    : null

  return NextResponse.json({
    today:       todayCount,
    week:        weekCount,
    month:       monthCount,
    dailyViews,
    topPages,
    devices:     deviceMap,
    lcp:         avgLcp,
    lcpSamples:  vitalsRaw.length,
  })
}
