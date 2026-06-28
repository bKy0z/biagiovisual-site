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
  const [lightbox,    setLightbox]    = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const gridRef    = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number | null>(null)

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

  // Blocca scroll pagina quando lightbox è aperto
  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  function scrollToGrid() {
    gridRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function downloadAll() {
    setDownloading(true)
    const a = document.createElement('a')
    a.href = `/api/gallery/${slug}/download`
    a.click()
    setTimeout(() => setDownloading(false), 3000)
  }

  // Touch swipe nel lightbox
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
    touchStart.current = null
  }

  const current = lightbox !== null ? photos[lightbox] : null

  return (
    <>
      <div style={{ background: '#080808', color: '#e8e0d4', fontFamily: 'DM Sans, sans-serif' }}>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="bv-hero" style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={title} style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
            }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: '#111' }} />
          )}

          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)',
          }} />

          <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, textAlign: 'center' }}>
            <p style={{
              fontFamily: 'Playfair Display, serif', color: 'rgba(255,255,255,0.65)',
              fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0,
            }}>Biagiovisuals</p>
          </div>

          <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>
            <h1 style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(1.6rem, 5vw, 4rem)',
              fontWeight: 700, color: '#fff', margin: '0 0 10px',
              textShadow: '0 2px 24px rgba(0,0,0,0.5)', letterSpacing: '0.02em',
            }}>
              {title}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 24px' }}>
              {photos.length} {photos.length === 1 ? 'fotografia' : 'fotografie'}
            </p>
            <button onClick={scrollToGrid} style={{
              padding: '10px 28px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '100px', color: '#fff', fontSize: '0.8rem',
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}>
              Visualizza le foto
            </button>
          </div>

          <button onClick={scrollToGrid} style={{
            position: 'absolute', bottom: '24px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: '1.4rem',
            animation: 'bvBounce 2s ease-in-out infinite',
          }} aria-label="Scorri verso il basso">↓</button>
        </section>

        {/* ── Griglia foto ──────────────────────────────────────────── */}
        <section ref={gridRef} style={{ padding: '32px 12px 24px', maxWidth: '1400px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '20px', paddingBottom: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            gap: '12px',
          }}>
            <h2 style={{
              fontFamily: 'Playfair Display, serif', color: '#e8e0d4',
              fontSize: '1.1rem', fontWeight: 600, margin: 0, flexShrink: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</h2>

            {downloadEnabled && photos.length > 0 && (
              <button onClick={downloadAll} disabled={downloading} style={{
                padding: '10px 20px', flexShrink: 0,
                background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.35)',
                borderRadius: '100px', color: '#c9a96e',
                fontSize: '0.82rem', cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>
                {downloading ? 'Preparazione…' : '↓ Scarica tutte'}
              </button>
            )}
          </div>

          {/* Griglia responsiva */}
          {photos.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.3, marginTop: '60px' }}>
              Nessuna foto in questa galleria.
            </p>
          ) : (
            <div className="bv-grid">
              {photos.map((photo, i) => (
                <div key={photo.id} className="bv-grid-item" onClick={() => setLightbox(i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbUrl} alt={photo.filename} loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </section>

        <footer style={{
          textAlign: 'center', padding: '32px 20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(232,224,212,0.15)', fontSize: '0.75rem',
        }}>
          © {new Date().getFullYear()} Biagiovisuals
        </footer>
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────── */}
      {current && (
        <div
          onClick={() => setLightbox(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Chiudi */}
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            color: '#e8e0d4', fontSize: '1.1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>

          {/* Prev */}
          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); prev() }} style={{
              position: 'absolute', left: '12px',
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#e8e0d4', fontSize: '1.6rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
          )}

          {/* Immagine */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.fullUrl} alt={current.filename} style={{
              maxWidth: '92vw', maxHeight: '82vh',
              objectFit: 'contain', borderRadius: '4px', display: 'block',
            }} />
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); next() }} style={{
              position: 'absolute', right: '12px',
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#e8e0d4', fontSize: '1.6rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>›</button>
          )}

          {/* Barra inferiore */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', bottom: '16px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <span style={{ color: 'rgba(232,224,212,0.35)', fontSize: '0.8rem' }}>
              {(lightbox ?? 0) + 1} / {photos.length}
            </span>
            {downloadEnabled && (
              <a href={current.fullUrl} download={current.filename}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: '9px 20px',
                  background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.4)',
                  borderRadius: '100px', color: '#c9a96e',
                  fontSize: '0.82rem', textDecoration: 'none',
                }}>↓ Scarica</a>
            )}
          </div>
        </div>
      )}

      <style>{`
        .bv-hero {
          height: 100svh;
          min-height: 500px;
        }
        .bv-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .bv-grid-item {
          cursor: zoom-in;
          overflow: hidden;
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          aspect-ratio: 3/2;
        }
        .bv-grid-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.35s ease;
        }
        .bv-grid-item:hover img {
          transform: scale(1.04);
        }
        @media (max-width: 640px) {
          .bv-hero {
            height: 56svh;
            min-height: 280px;
          }
          .bv-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 3px;
          }
          .bv-grid-item {
            border-radius: 2px;
          }
        }
        @media (min-width: 1024px) {
          .bv-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
        }
        @keyframes bvBounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(8px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
