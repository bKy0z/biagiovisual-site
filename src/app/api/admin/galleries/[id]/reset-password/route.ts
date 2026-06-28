import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getAdminSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// Genera password leggibile tipo ABCD-1234-EFGH
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pwd = ''
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) pwd += '-'
    pwd += chars[crypto.randomInt(chars.length)]
  }
  return pwd
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await getAdminSession()) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = await params

  const gallery = await prisma.gallery.findUnique({ where: { id }, select: { id: true } })
  if (!gallery) return NextResponse.json({ error: 'Galleria non trovata' }, { status: 404 })

  const newPassword = generatePassword()
  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.gallery.update({ where: { id }, data: { passwordHash } })

  // La password in chiaro viene restituita UNA SOLA VOLTA e non viene mai salvata
  return NextResponse.json({ password: newPassword })
}
