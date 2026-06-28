import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAdminSession } from '@/lib/session'
import { r2KeyHomeFull, r2KeyHomeThumb, signedPutUrl } from '@/lib/r2'

export async function POST(request: NextRequest) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { filename, contentType } = await request.json()
  if (!filename || !contentType) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const uuid           = randomUUID()
  const ext            = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storageKeyFull  = r2KeyHomeFull(uuid, ext)
  const storageKeyThumb = r2KeyHomeThumb(uuid)
  const uploadUrl       = await signedPutUrl(storageKeyFull, contentType)

  return NextResponse.json({ uploadUrl, storageKeyFull, storageKeyThumb })
}
