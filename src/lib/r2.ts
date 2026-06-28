import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!

// ─── Chiavi storage ───────────────────────────────────────────────────────────

export const r2KeyFull  = (slug: string, uuid: string, ext: string) =>
  `galleries/${slug}/full/${uuid}.${ext}`

export const r2KeyThumb = (slug: string, uuid: string) =>
  `galleries/${slug}/thumb/${uuid}.webp`

export const r2KeyHomeFull  = (uuid: string, ext: string) => `homepage/full/${uuid}.${ext}`
export const r2KeyHomeThumb = (uuid: string) => `homepage/thumb/${uuid}.webp`

// ─── URL firmati ─────────────────────────────────────────────────────────────

/** URL firmato per LEGGERE un file da R2 (anteprime, download HD). */
export async function signedReadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn },
  )
}

/**
 * URL firmato per SCRIVERE un file su R2 direttamente dal browser.
 * Usato per l'upload foto: il browser carica direttamente su R2 (nessun limite Vercel).
 */
export async function signedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 900, // 15 min
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  )
}

/** Scarica un file da R2 e restituisce un Buffer (usato server-side per la generazione thumbnail). */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
