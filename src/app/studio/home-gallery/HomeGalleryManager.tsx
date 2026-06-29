'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface HomePhoto {
  id:       string
  url:      string
  category: string
  title:    string
  date:     string
}

const CAT_LABEL: Record<string, string> = {
  eventi:   'Eventi',
  ritratti: 'Ritratti',
  social:   'Social Media',
}
const CATS = Object.keys(CAT_LABEL)

// ─── Helpers ────────────────────────────────────────────────────────────────

function StudioHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      position: 'sticky', top: 0, background: 'rgba(8,8,8,0.95)',
      backdropFilter: 'blur(12px)', zIndex: 10, height: '64px', gap: '32px',
    }}>
      <span style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>
        Biagio Visconti
      </span>
      <nav style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {[
          { label: 'Gallerie clienti', href: '/studio/dashboard' },
          { label: 'Galleria home',    href: '/studio/home-gallery' },
        ].map(({ label, href }) => {
          const active = href === '/studio/home-gallery'
          return (
            <Link key={href} href={href} style={{
              padding: '6px 16px', borderRadius: '8px', textDecoration: 'none',
              fontSize: '0.82rem', fontWeight: 500,
              background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
              color: active ? '#c9a96e' : 'rgba(232,224,212,0.4)',
              border: active ? '1px solid rgba(201,169,110,0.25)' : '1px solid transparent',
              transition: 'all 0.2s',
            }}>
              {label}
            </Link>
          )
        })}
      </nav>
      <button onClick={onLogout} style={{
        padding: '6px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '100px', color: 'rgba(232,224,212,0.4)', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
      }}>
        Esci
      </button>
    </header>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function HomeGalleryManager({ initialPhotos }: { initialPhotos: HomePhoto[] }) {
  const router = useRouter()

  const [photos, setPhotos]       = useState<HomePhoto[]>(initialPhotos)
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [selCat, setSelCat]       = useState<string | null>(null)
  const [title, setTitle]         = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [view, setView]           = useState<'upload' | 'manage'>('upload')
  const [dragOver, setDragOver]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    router.push('/studio')
  }

  // ── File selection ────────────────────────────────────────────────────────

  function pickFile(f: File) {
    if (!f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setSelCat(null)
    setTitle('')
    setError(null)
  }

  function resetUpload() {
    setFile(null); setPreview(null); setSelCat(null); setTitle(''); setError(null)
  }

  // ── Upload (3-step: prepare → R2 → process) ──────────────────────────────

  async function upload() {
    if (!file || !selCat) return
    setUploading(true)
    setError(null)

    try {
      setProgress('Preparazione...')
      const prepRes = await fetch('/api/admin/home-gallery/upload/prepare', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!prepRes.ok) { const e = await prepRes.json(); throw new Error(e.error) }
      const { uploadUrl, storageKeyFull, storageKeyThumb } = await prepRes.json()

      setProgress('Caricamento su cloud...')
      const putRes = await fetch(uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
      })
      if (!putRes.ok) throw new Error('Upload fallito')

      setProgress('Elaborazione immagine...')
      const procRes = await fetch('/api/admin/home-gallery/upload/process', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKeyFull, storageKeyThumb, filename: file.name,
          contentType: file.type, title: title.trim() || 'Senza titolo', category: selCat,
        }),
      })
      if (!procRes.ok) { const e = await procRes.json(); throw new Error(e.error) }
      const photo: HomePhoto = await procRes.json()

      setPhotos(prev => [photo, ...prev])
      resetUpload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setUploading(false); setProgress(null)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deletePhoto(id: string) {
    setDeletingId(id)
    try {
      const res  = await fetch(`/api/admin/home-gallery/${id}`, { method: 'DELETE', credentials: 'same-origin' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setPhotos(prev => prev.filter(p => p.id !== id))
      setConfirmId(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Category change ───────────────────────────────────────────────────────

  async function changeCategory(id: string, category: string) {
    await fetch(`/api/admin/home-gallery/${id}`, {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, category } : p))
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const canSave = !!file && !!selCat && !uploading

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e4d4', fontFamily: 'Inter, sans-serif' }}>
      <StudioHeader onLogout={logout} />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Page title */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', fontWeight: 700, color: '#e8e4d4', margin: 0 }}>
            Galleria Homepage
          </h1>
          <p style={{ color: 'rgba(232,224,212,0.4)', fontSize: '0.85rem', margin: '6px 0 0' }}>
            Le foto qui appaiono nella griglia della homepage. Aggiunge e rimuovi liberamente.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          {(['upload', 'manage'] as const).map(t => (
            <button key={t} onClick={() => setView(t)} style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer',
              fontWeight: view === t ? 600 : 400,
              background: view === t ? 'rgba(201,169,110,0.12)' : 'transparent',
              color: view === t ? '#c9a96e' : 'rgba(232,224,212,0.4)',
              border: view === t ? '1px solid rgba(201,169,110,0.25)' : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s',
            }}>
              {t === 'upload' ? '+ Aggiungi foto' : `Gestisci (${photos.length})`}
            </button>
          ))}
        </div>

        {/* ─── UPLOAD TAB ─── */}
        {view === 'upload' && (
          <div style={{ maxWidth: '580px' }}>
            {!file ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#c9a96e' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '16px', padding: '60px 32px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(201,169,110,0.05)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>📷</div>
                <p style={{ color: 'rgba(232,224,212,0.6)', margin: '0 0 6px', fontSize: '0.95rem' }}>
                  Trascina una foto qui o clicca per scegliere
                </p>
                <p style={{ color: 'rgba(232,224,212,0.3)', margin: 0, fontSize: '0.78rem' }}>
                  JPG, PNG, WEBP — qualsiasi dimensione
                </p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
              </div>
            ) : (
              <div>
                {/* Preview */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview!} alt="Anteprima"
                    style={{ width: '100%', maxHeight: '360px', objectFit: 'cover', display: 'block' }} />
                  <button onClick={resetUpload} style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                    borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem',
                  }}>×</button>
                </div>

                {/* Title */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(232,224,212,0.5)', display: 'block', marginBottom: '6px' }}>
                    TITOLO
                  </label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="es. Matrimonio di Giulia e Marco"
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', padding: '10px 14px', color: '#e8e4d4', fontSize: '0.9rem',
                      outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>

                {/* Category */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(232,224,212,0.5)', display: 'block', marginBottom: '10px' }}>
                    CATEGORIA
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {CATS.map(cat => (
                      <button key={cat} onClick={() => setSelCat(cat)} style={{
                        flex: 1, padding: '10px 0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem',
                        fontWeight: selCat === cat ? 600 : 400,
                        background: selCat === cat ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selCat === cat ? '#c9a96e' : 'rgba(232,224,212,0.5)',
                        border: selCat === cat ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.2s',
                      }}>
                        {CAT_LABEL[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                {/* Progress */}
                {progress && (
                  <div style={{ padding: '10px 14px', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: '8px', color: '#c9a96e', fontSize: '0.82rem', marginBottom: '16px' }}>
                    {progress}
                  </div>
                )}

                <button onClick={upload} disabled={!canSave} style={{
                  width: '100%', padding: '13px', borderRadius: '10px', fontSize: '0.9rem',
                  fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
                  background: canSave ? 'linear-gradient(135deg, #c9a96e, #a07842)' : 'rgba(255,255,255,0.06)',
                  color: canSave ? '#080808' : 'rgba(232,224,212,0.2)',
                  border: 'none', transition: 'all 0.2s',
                }}>
                  {uploading ? 'Caricamento...' : 'Aggiungi alla galleria'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── MANAGE TAB ─── */}
        {view === 'manage' && (
          <div>
            {photos.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 0',
                color: 'rgba(232,224,212,0.3)', fontSize: '0.9rem',
              }}>
                Nessuna foto ancora. Vai su <strong style={{ color: '#c9a96e' }}>Aggiungi foto</strong> per caricare.
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Totale', value: photos.length },
                    ...CATS.map(c => ({ label: CAT_LABEL[c], value: photos.filter(p => p.category === c).length })),
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: '10px 18px', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px',
                      display: 'flex', gap: '10px', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c9a96e' }}>{s.value}</span>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(232,224,212,0.4)' }}>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '12px', overflow: 'hidden',
                      position: 'relative',
                      opacity: deletingId === photo.id ? 0.4 : 1,
                      transition: 'opacity 0.3s',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.title}
                        style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover', display: 'block' }} />

                      <div style={{ padding: '12px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 500, color: '#e8e4d4' }}>
                          {photo.title}
                        </p>
                        <p style={{ margin: '0 0 10px', fontSize: '0.73rem', color: 'rgba(232,224,212,0.35)' }}>
                          {new Date(photo.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>

                        {/* Category selector */}
                        <select
                          value={photo.category}
                          onChange={e => changeCategory(photo.id, e.target.value)}
                          style={{
                            width: '100%', padding: '6px 10px', marginBottom: '8px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px', color: '#e8e4d4', fontSize: '0.8rem', cursor: 'pointer',
                          }}
                        >
                          {CATS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                        </select>

                        {/* Delete */}
                        {confirmId === photo.id ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => deletePhoto(photo.id)} style={{
                              flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
                              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                              color: '#fca5a5', fontSize: '0.75rem',
                            }}>
                              Conferma
                            </button>
                            <button onClick={() => setConfirmId(null)} style={{
                              flex: 1, padding: '6px', borderRadius: '6px', cursor: 'pointer',
                              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(232,224,212,0.4)', fontSize: '0.75rem',
                            }}>
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(photo.id)} style={{
                            width: '100%', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                            background: 'transparent', border: '1px solid rgba(239,68,68,0.2)',
                            color: 'rgba(239,68,68,0.5)', fontSize: '0.75rem', transition: 'all 0.2s',
                          }}>
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
