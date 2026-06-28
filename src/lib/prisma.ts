import { PrismaClient } from '@prisma/client'

// Pattern singleton: in sviluppo Next.js ricarica i moduli ad ogni hot-reload
// e creerebbe troppe connessioni al DB senza questo pattern.
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
