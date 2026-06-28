'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Gallery {
  id:            string
  slug:          string
  title:         string
  coverPhotoId:  string | null
  coverThumbUrl: string | null
  expiresAt:     string
  createdAt:     string
  _count:        { photos: number }
}

function expiryBadge(expiresAt: string) {
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: 'Scaduta',       color: '#f87171' }
  if (days < 8)  return { label: `Scade tra ${days}g`, color: '#fbbf24' }
  return           { label: `Scade tra ${days}g`, color: '#4ade80' }
}

// ─── Modal crea galleria ──────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: {
  onClose:   () => void
  onCreated: (g: Gallery) => void
}) {
  const [title,    setTitle]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/galleries', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, password }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setLoading(false); return }

    onCreated({ ...data, coverThumbUrl: null })
    onClose()
  }

  return (
    <div style={{
      position:       'fixed', inset: 0, zIndex: 100,
      display:        'flex', alignItems: 'center', justifyContent: 'center',
      background:     'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: '420px', padding: '40px',
        background: '#111', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
      }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', margin: '0 0 28px', fontSize: '1.3rem' }}>
          Nuova galleria
        </h2>
        <form onSubmit={submit}>
          {[
            { label: 'Titolo', value: title,    set: setTitle,    type: 'text',     ph: 'Es. Matrimonio Rossi 2026' },
            { label: 'Password cliente', value: password, set: setPassword, type: 'text', ph: 'Min. 6 caratteri' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(232,224,212,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                {f.label}
              </label>
              <input
                type={f.type} value={f.value} placeholder={f.ph} required
                onChange={e => f.set(e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#e8e0d4', fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
          ))}
          {error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '16px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '11px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
              color: 'rgba(232,224,212,0.6)', cursor: 'pointer', fontSize: '0.88rem',
            }}>
              Annulla
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '11px', background: 'rgba(201,169,110,0.15)',
              border: '1px solid rgba(201,169,110,0.4)', borderRadius: '10px',
              color: '#c9a96e', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 500,
            }}>
              {loading ? 'Creazione…' : 'Crea galleria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Dashboard principale ─────────────────────────────────────────────────────

export default function DashboardClient({ galleries: initial }: { galleries: Gallery[] }) {
  const [galleries, setGalleries] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/studio')
  }

  function onCreated(g: Gallery) {
    setGalleries(prev => [g, ...prev])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e0d4', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)', zIndex: 10,
        height: '64px', gap: '32px',
      }}>
        <span style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>
          Biagiovisuals Studio
        </span>
        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {[
            { label: 'Gallerie clienti', href: '/studio/dashboard' },
            { label: 'Galleria home',    href: '/studio/home-gallery' },
          ].map(({ label, href }) => {
            const active = href === '/studio/dashboard'
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
        <button onClick={logout} style={{
          padding: '6px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '100px', color: 'rgba(232,224,212,0.4)', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
        }}>
          Esci
        </button>
      </header>

      {/* Contenuto */}
      <main style={{ padding: '48px 40px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, margin: 0 }}>
            Gallerie
          </h1>
          <button onClick={() => setShowModal(true)} style={{
            padding: '10px 24px', background: 'rgba(201,169,110,0.12)',
            border: '1px solid rgba(201,169,110,0.35)', borderRadius: '100px',
            color: '#c9a96e', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
          }}>
            + Nuova galleria
          </button>
        </div>

        {galleries.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px',
          }}>
            <p style={{ opacity: 0.4, marginBottom: '20px' }}>Nessuna galleria ancora</p>
            <button onClick={() => setShowModal(true)} style={{
              padding: '10px 24px', background: 'rgba(201,169,110,0.12)',
              border: '1px solid rgba(201,169,110,0.35)', borderRadius: '100px',
              color: '#c9a96e', fontSize: '0.88rem', cursor: 'pointer',
            }}>
              Crea la prima galleria
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {galleries.map(g => {
              const badge = expiryBadge(g.expiresAt)
              return (
                <Link key={g.id} href={`/studio/galleria/${g.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                    cursor: 'pointer', transition: 'border-color 0.2s', overflow: 'hidden',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  >
                    {/* Copertina */}
                    <div style={{
                      width: '100%', aspectRatio: '3/2', overflow: 'hidden',
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {g.coverThumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.coverThumbUrl}
                          alt={g.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '18px 20px' }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', color: '#e8e0d4', margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>
                        {g.title}
                      </h3>
                      <p style={{ color: 'rgba(232,224,212,0.45)', fontSize: '0.8rem', margin: '0 0 12px' }}>
                        {g._count.photos} foto
                      </p>
                      <span style={{
                        fontSize: '0.72rem', padding: '3px 9px',
                        borderRadius: '100px', background: `${badge.color}18`,
                        border: `1px solid ${badge.color}44`, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={onCreated} />}
    </div>
  )
}
