'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Photo {
  id:       string
  filename: string
  width:    number | null
  height:   number | null
  thumbUrl: string
  fullUrl:  string
}

export default function GalleryView({
  slug,
  title,
  photos,
  coverUrl,
  downloadEnabled,
}: {
  slug:            string
  title:           string
  photos:          Photo[]
  coverUrl:        string | null
  downloadEnabled: boolean
}) {
  const [lightbox,     setLightbox]     = useState<number | null>(null)
  const [downloading,  setDownloading]  = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const prev = useCallback(() =>
    setLightbox(i => i !== null ? (i - 1 + photos.length) % photos.length : null),
    [photos.length],
  )
  const next = useCallback(() =>
    setLightbox(i => i !== null ? (i + 1) % photos.length : null),
    [photos.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')       prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape')     setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, prev, next])

  function scrollToGrid() {
    gridRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function downloadAll() {
    setDownloading(true)
    const a = document.createElement('a')
    a.href = `/api/gallery/${slug}/download`
    a.click()
    // Delay per dare tempo al browser di avviare il download
    setTimeout(() => setDownloading(false), 3000)
  }

  const current = lightbox !== null ? photos[lightbox] : null

  return (
    <>
      <div style={{ background: '#080808', color: '#e8e0d4', fontFamily: 'DM Sans, sans-serif' }}>

        {/* ── Hero a schermo intero ───────────────────────────────── */}
        <section style={{
          position: 'relative', height: '100svh', minHeight: '500px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Foto di copertina */}
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={title}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
          )}

          {/* Gradient overlay scuro */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)',
          }} />

          {/* Logo in alto */}
          <div style={{
            position: 'absolute', top: '28px', left: 0, right: 0,
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'Playfair Display, serif', color: 'rgba(255,255,255,0.7)',
              fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase',
              margin: 0,
            }}>
              Biagiovisuals
            </p>
          </div>

          {/* Titolo centrato */}
          <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>
            <h1 style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(2rem, 6vw, 4.5rem)',
              fontWeight: 700, color: '#fff',
              margin: '0 0 16px',
              textShadow: '0 2px 24px rgba(0,0,0,0.5)',
              letterSpacing: '0.02em',
            }}>
              {title}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 36px' }}>
              {photos.length} {photos.length === 1 ? 'fotografia' : 'fotografie'}
            </p>
            <button
              onClick={scrollToGrid}
              style={{
                padding: '12px 32px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '100px', color: '#fff',
                fontSize: '0.82rem', letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,169,110,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,169,110,0.6)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.35)'
              }}
            >
              Visualizza le foto
            </button>
          </div>

          {/* Freccia scroll */}
          <button
            onClick={scrollToGrid}
            style={{
              position: 'absolute', bottom: '32px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: '1.4rem',
              animation: 'bvBounce 2s ease-in-out infinite',
            }}
            aria-label="Scorri verso il basso"
          >
            ↓
          </button>
        </section>

        {/* ── Griglia masonry ─────────────────────────────────────── */}
        <section ref={gridRef} style={{ padding: '48px 20px 24px', maxWidth: '1400px', margin: '0 auto' }}>

          {/* Header griglia */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '28px', paddingBottom: '20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <h2 style={{
              fontFamily: 'Playfair Display, serif', color: '#e8e0d4',
              fontSize: '1.2rem', fontWeight: 600, margin: 0,
            }}>
              {title}
            </h2>
            {downloadEnabled && photos.length > 0 && (
              <button
                onClick={downloadAll}
                disabled={downloading}
                style={{
                  padding: '7px 18px',
                  background: 'rgba(201,169,110,0.1)',
                  border: '1px solid rgba(201,169,110,0.3)',
                  borderRadius: '100px', color: '#c9a96e',
                  fontSize: '0.82rem', cursor: downloading ? 'not-allowed' : 'pointer',
                  opacity: downloading ? 0.6 : 1,
                }}
              >
                {downloading ? 'Preparazione…' : '↓ Scarica tutte'}
              </button>
            )}
          </div>

          {photos.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.3, marginTop: '60px' }}>
              Nessuna foto in questa galleria.
            </p>
          ) : (
            <div style={{ columns: '3 260px', columnGap: '10px' }}>
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={() => setLightbox(i)}
                  style={{
                    breakInside: 'avoid', marginBottom: '10px',
                    cursor: 'zoom-in', overflow: 'hidden',
                    borderRadius: '6px', background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt={photo.filename}
                    loading="lazy"
                    style={{ width: '100%', display: 'block', transition: 'transform 0.35s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)' }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <footer style={{
          textAlign: 'center', padding: '36px 20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(232,224,212,0.15)', fontSize: '0.76rem',
        }}>
          © {new Date().getFullYear()} Biagiovisuals
        </footer>
      </div>

      {/* ── Lightbox ────────────────────────────────────────────── */}
      {current && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: '18px', right: '18px',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#e8e0d4', fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          {photos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              style={{
                position: 'absolute', left: '16px',
                width: '46px', height: '46px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#e8e0d4', fontSize: '1.5rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >‹</button>
          )}

          <div onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.fullUrl}
              alt={current.filename}
              style={{
                maxWidth: '90vw', maxHeight: '88vh',
                objectFit: 'contain', borderRadius: '4px', display: 'block',
              }}
            />
          </div>

          {photos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); next() }}
              style={{
                position: 'absolute', right: '16px',
                width: '46px', height: '46px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#e8e0d4', fontSize: '1.5rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >›</button>
          )}

          <div style={{
            position: 'absolute', bottom: '20px',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <span style={{ color: 'rgba(232,224,212,0.35)', fontSize: '0.8rem' }}>
              {(lightbox ?? 0) + 1} / {photos.length}
            </span>
            {downloadEnabled && (
              <a
                href={current.fullUrl}
                download={current.filename}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: '7px 16px',
                  background: 'rgba(201,169,110,0.15)',
                  border: '1px solid rgba(201,169,110,0.4)',
                  borderRadius: '100px', color: '#c9a96e',
                  fontSize: '0.82rem', textDecoration: 'none',
                }}
              >↓ Scarica</a>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bvBounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(8px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
