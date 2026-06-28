import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Le immagini HD vengono servite tramite signed URL R2, non tramite Next.js Image Optimizer.
  // Le anteprime (thumbnail) sono già ottimizzate da sharp in fase di upload.

  // Permetti al build di procedere anche se Prisma non è ancora configurato (es. prima migrazione)
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
