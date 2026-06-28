'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Photo {
  id:             string
  filename:       string
  storageKeyFull: string
  width:          number | null
  height:         number | null
  sizeBytes:      string | null
  sortOrder:      number
  thumbUrl:       string
}

interface Gallery {
  id:              string
  slug:            string
  title:           string
  downloadEnabled: boolean
  coverPhotoId:    string | null
  expiresAt:       string
  createdAt:       string
}

interface UploadItem {
  name:    string
  status:  'queued' | 'uploading' | 'processing' | 'done' | 'error'
  message: string
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? ''

export default function GalleryManager({
  gallery,
  initialPhotos,
}: {
  gallery:       Gallery
  initialPhotos: Photo[]
}) {
  const [photos,         setPhotos]         = useState<Photo[]>(initialPhotos)
  const [uploads,        setUploads]        = useState<UploadItem[]>([])
  const [dragging,       setDragging]       = useState(false)
  const [copied,         setCopied]         = useState(false)
  const [dlEnabled,      setDlEnabled]      = useState(gallery.downloadEnabled)
  const [daysLeftState,  setDaysLeftState]  = useState(Math.floor((new Date(gallery.expiresAt).getTime() - Date.now()) / 86_400_000))
  const [newPassword,    setNewPassword]    = useState<string | null>(null)
  const [resetting,      setResetting]      = useState(false)
  const [extending,      setExtending]      = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router       = useRouter()

  const clientLink = `${BASE_URL}/galleria/${gallery.slug}`

  // ─── Upload ──────────────────────────────────────────────────────────────────

  function updateUpload(name: string, patch: Partial<UploadItem>) {
    setUploads(prev => prev.map(u => u.name === name ? { ...u, ...patch } : u))
  }

  const uploadFile = useCallback(async (file: File) => {
    const item: UploadItem = { name: file.name, status: 'uploading', message: 'Caricamento…' }
    setUploads(prev => [...prev, item])

    try {
      // Step 1 — Ottieni URL firmato per caricare direttamente su R2
      const prepRes = await fetch(`/api/admin/galleries/${gallery.id}/photos/prepare`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!prepRes.ok) throw new Error('Preparazione upload fallita')

      const { uploadUrl, storageKeyFull, storageKeyThumb } = await prepRes.json()

      // Step 2 — Carica il file direttamente su R2 (nessun limite Vercel)
      const putRes = await fetch(uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': file.type },
        body:    file,
      })
      if (!putRes.ok) throw new Error('Upload su R2 fallito')

      // Step 3 — Genera anteprima e salva nel DB
      updateUpload(file.name, { status: 'processing', message: 'Elaborazione anteprima…' })

      const procRes = await fetch(`/api/admin/galleries/${gallery.id}/photos/process`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          storageKeyFull,
          storageKeyThumb,
          filename:    file.name,
          contentType: file.type,
          size:        file.size,
        }),
      })
      if (!procRes.ok) throw new Error('Elaborazione anteprima fallita')

      const photo: Photo = await procRes.json()
      setPhotos(prev => [...prev, photo])
      updateUpload(file.name, { status: 'done', message: 'Caricata' })
    } catch (err) {
      updateUpload(file.name, { status: 'error', message: String(err) })
    }
  }, [gallery.id])

  async function handleFiles(files: File[]) {
    const images = files.filter(f => f.type.startsWith('image/'))
    for (const file of images) {
      await uploadFile(file) // sequenziale per non sovraccaricare
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  // ─── Elimina foto ─────────────────────────────────────────────────────────

  async function deletePhoto(photoId: string) {
    if (!confirm('Eliminare questa foto? L\'azione non è reversibile.')) return
    const res = await fetch(`/api/admin/galleries/${gallery.id}/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  // ─── Imposta copertina ────────────────────────────────────────────────────

  async function setCover(photoId: string) {
    const newId = gallery.coverPhotoId === photoId ? null : photoId
    await fetch(`/api/admin/galleries/${gallery.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ coverPhotoId: newId }),
    })
    router.refresh()
  }

  // ─── Copia link ──────────────────────────────────────────────────────────

  function copyLink() {
    navigator.clipboard.writeText(clientLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleDownload() {
    const next = !dlEnabled
    setDlEnabled(next)
    await fetch(`/api/admin/galleries/${gallery.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ downloadEnabled: next }),
    })
  }

  async function extendGallery() {
    setExtending(true)
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    await fetch(`/api/admin/galleries/${gallery.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ expiresAt }),
    })
    setDaysLeftState(90)
    setExtending(false)
  }

  async function resetPassword() {
    setResetting(true)
    setNewPassword(null)
    const res  = await fetch(`/api/admin/galleries/${gallery.id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setNewPassword(data.password)
    setResetting(false)
  }

  async function deleteGallery() {
    if (!confirm(`Eliminare la galleria "${gallery.title}" e tutte le sue foto? Questa azione non è reversibile.`)) return
    setDeleting(true)
    await fetch(`/api/admin/galleries/${gallery.id}`, { method: 'DELETE' })
    router.push('/studio/dashboard')
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/studio')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const s = { fontFamily: 'DM Sans, sans-serif', minHeight: '100vh', background: '#080808', color: '#e8e0d4' }

  return (
    <div style={s}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/studio/dashboard" style={{ color: 'rgba(232,224,212,0.4)', fontSize: '0.82rem', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontFamily: 'Playfair Display, serif', color: '#e8e0d4', fontSize: '1rem', fontWeight: 600 }}>
            {gallery.title}
          </span>
        </div>
        <button onClick={logout} style={{
          padding: '7px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '100px', color: 'rgba(232,224,212,0.5)', fontSize: '0.82rem', cursor: 'pointer',
        }}>
          Esci
        </button>
      </header>

      <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Info bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
          marginBottom: '36px', padding: '16px 24px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(232,224,212,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Link cliente
            </p>
            <code style={{ fontSize: '0.82rem', color: '#c9a96e', wordBreak: 'break-all' }}>
              {clientLink}
            </code>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(232,224,212,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              Scadenza
            </p>
            <span style={{ fontSize: '0.85rem', color: daysLeftState < 0 ? '#f87171' : daysLeftState < 8 ? '#fbbf24' : '#4ade80' }}>
              {daysLeftState < 0 ? 'Scaduta' : `Tra ${daysLeftState} giorni`}
            </span>
          </div>
          <button onClick={copyLink} style={{
            padding: '9px 20px', background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(201,169,110,0.1)',
            border: `1px solid ${copied ? 'rgba(74,222,128,0.4)' : 'rgba(201,169,110,0.3)'}`,
            borderRadius: '100px', color: copied ? '#4ade80' : '#c9a96e',
            fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {copied ? '✓ Copiato' : 'Copia link'}
          </button>
        </div>

        {/* Zona upload */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border:       `2px dashed ${dragging ? 'rgba(201,169,110,0.6)' : 'rgba(201,169,110,0.22)'}`,
            borderRadius: '16px',
            padding:      '48px 32px',
            textAlign:    'center',
            cursor:       'pointer',
            marginBottom: '36px',
            background:   dragging ? 'rgba(201,169,110,0.04)' : 'transparent',
            transition:   'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFiles(Array.from(e.target.files ?? []))}
          />
          <p style={{ margin: '0 0 8px', fontSize: '1rem', color: 'rgba(232,224,212,0.7)' }}>
            Trascina le foto qui, oppure clicca per selezionare
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(232,224,212,0.3)' }}>
            JPG, PNG, WEBP — upload diretto su R2 (nessun limite di dimensione)
          </p>
        </div>

        {/* Coda upload in corso */}
        {uploads.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(232,224,212,0.4)', marginBottom: '12px' }}>
              Upload in corso
            </h3>
            {uploads.map(u => (
              <div key={u.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', marginBottom: '6px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                border: `1px solid ${u.status === 'error' ? 'rgba(248,113,113,0.2)' : u.status === 'done' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(232,224,212,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {u.name}
                </span>
                <span style={{
                  fontSize: '0.78rem', marginLeft: '16px', whiteSpace: 'nowrap',
                  color: u.status === 'error' ? '#f87171' : u.status === 'done' ? '#4ade80' : '#c9a96e',
                }}>
                  {u.status === 'error' ? '✗ Errore' : u.status === 'done' ? '✓ Caricata' : u.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Griglia foto */}
        {photos.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(232,224,212,0.3)', padding: '60px 0' }}>
            Nessuna foto ancora. Carica le prime immagini qui sopra.
          </p>
        ) : (
          <>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(232,224,212,0.4)', marginBottom: '20px' }}>
              {photos.length} {photos.length === 1 ? 'foto' : 'foto'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {photos.map(photo => (
                <div
                  key={photo.id}
                  style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1', background: '#111' }}
                  className="photo-cell"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt={photo.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {/* Badge copertina */}
                  {gallery.coverPhotoId === photo.id && (
                    <span style={{
                      position: 'absolute', top: '8px', left: '8px',
                      background: 'rgba(201,169,110,0.9)', color: '#080808',
                      fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px',
                      borderRadius: '100px', letterSpacing: '0.05em',
                    }}>
                      COPERTINA
                    </span>
                  )}
                  {/* Overlay azioni */}
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <button onClick={() => setCover(photo.id)} style={btnStyle('#c9a96e')}>
                      {gallery.coverPhotoId === photo.id ? 'Rimuovi copertina' : 'Imposta copertina'}
                    </button>
                    <button onClick={() => deletePhoto(photo.id)} style={btnStyle('#f87171')}>
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {/* ── Impostazioni galleria ────────────────────────────────── */}
        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(232,224,212,0.35)', marginBottom: '20px' }}>
            Impostazioni galleria
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>

            {/* Toggle download */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#e8e0d4' }}>Download abilitato</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(232,224,212,0.35)' }}>
                  Il cliente può scaricare le foto originali
                </p>
              </div>
              <button
                onClick={toggleDownload}
                style={{
                  width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                  background: dlEnabled ? 'rgba(201,169,110,0.7)' : 'rgba(255,255,255,0.12)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: dlEnabled ? '25px' : '3px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Estendi scadenza */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#e8e0d4' }}>Estendi scadenza</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(232,224,212,0.35)' }}>
                  Aggiunge 90 giorni dalla data odierna
                </p>
              </div>
              <button
                onClick={extendGallery}
                disabled={extending}
                style={{
                  padding: '8px 16px', background: 'rgba(74,222,128,0.1)',
                  border: '1px solid rgba(74,222,128,0.3)', borderRadius: '100px',
                  color: '#4ade80', fontSize: '0.8rem',
                  cursor: extending ? 'not-allowed' : 'pointer', flexShrink: 0,
                }}
              >
                {extending ? 'Aggiornamento…' : '+90 giorni'}
              </button>
            </div>

            {/* Rinnova password */}
            <div style={{
              padding: '16px 20px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: newPassword ? '12px' : 0 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#e8e0d4' }}>Rinnova password</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(232,224,212,0.35)' }}>
                    Genera una nuova password casuale
                  </p>
                </div>
                <button
                  onClick={resetPassword}
                  disabled={resetting}
                  style={{
                    padding: '8px 16px', background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.3)', borderRadius: '100px',
                    color: '#fbbf24', fontSize: '0.8rem',
                    cursor: resetting ? 'not-allowed' : 'pointer', flexShrink: 0,
                  }}
                >
                  {resetting ? 'Generazione…' : 'Nuova password'}
                </button>
              </div>
              {newPassword && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: 'rgba(251,191,36,0.6)', letterSpacing: '0.08em' }}>
                    NUOVA PASSWORD — mostrala solo una volta
                  </p>
                  <code style={{ fontSize: '1rem', color: '#fbbf24', letterSpacing: '0.08em', fontWeight: 600 }}>
                    {newPassword}
                  </code>
                </div>
              )}
            </div>

            {/* Elimina galleria */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'rgba(248,113,113,0.04)',
              border: '1px solid rgba(248,113,113,0.12)', borderRadius: '12px',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#f87171' }}>Elimina galleria</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(248,113,113,0.45)' }}>
                  Rimuove tutte le foto da R2 e il DB. Irreversibile.
                </p>
              </div>
              <button
                onClick={deleteGallery}
                disabled={deleting}
                style={{
                  padding: '8px 16px', background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)', borderRadius: '100px',
                  color: '#f87171', fontSize: '0.8rem',
                  cursor: deleting ? 'not-allowed' : 'pointer', flexShrink: 0,
                }}
              >
                {deleting ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>

          </div>
        </div>

      </main>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding:      '7px 16px',
    background:   `${color}18`,
    border:       `1px solid ${color}55`,
    borderRadius: '100px',
    color,
    fontSize:     '0.75rem',
    cursor:       'pointer',
    whiteSpace:   'nowrap',
  }
}
