'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ─── Tipi ────────────────────────────────────────────────────────────────────

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

interface Analytics {
  today:      number
  week:       number
  month:      number
  dailyViews: Array<{ date: string; views: number }>
  topPages:   Array<{ path: string; views: number }>
  devices:    Record<string, number>
  lcp:        number | null
  lcpSamples: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryBadge(expiresAt: string) {
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0)  return { label: 'Scaduta',           color: '#f87171' }
  if (days < 8)  return { label: `Scade tra ${days}g`, color: '#fbbf24' }
  return           { label: `Scade tra ${days}g`,       color: '#4ade80' }
}

function lcpRating(ms: number): { label: string; color: string } {
  if (ms < 2500) return { label: 'Ottima',    color: '#4ade80' }
  if (ms < 4000) return { label: 'Discreta',  color: '#fbbf24' }
  return           { label: 'Da migliorare', color: '#f87171' }
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// ─── Header condiviso ─────────────────────────────────────────────────────────

function StudioHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="dash-header" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky', top: 0, background: 'rgba(8,8,8,0.97)',
      backdropFilter: 'blur(12px)', zIndex: 10, height: '60px', gap: '24px',
    }}>
      <span className="dash-logo" style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', fontSize: '1rem', fontWeight: 700, flexShrink: 0 }}>
        Biagio Visconti
      </span>
      <nav className="dash-nav" style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {[
          { label: 'Dashboard',     href: '/studio/dashboard' },
          { label: 'Gallerie clienti', href: '/studio/dashboard#galleries' },
          { label: 'Galleria home',  href: '/studio/home-gallery' },
        ].map(({ label, href }) => {
          const active = href === '/studio/dashboard'
          return (
            <Link key={href} href={href} style={{
              padding: '5px 14px', borderRadius: '8px', textDecoration: 'none',
              fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap',
              background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
              color:      active ? '#c9a96e' : 'rgba(232,224,212,0.35)',
              border:     active ? '1px solid rgba(201,169,110,0.25)' : '1px solid transparent',
            }}>
              {label}
            </Link>
          )
        })}
      </nav>
      <button onClick={onLogout} className="dash-logout" style={{
        padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '100px', color: 'rgba(232,224,212,0.35)', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0,
      }}>
        Esci
      </button>
    </header>
  )
}

// ─── Card metrica ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '16px', padding: '22px 24px',
    }}>
      <p style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,224,212,0.35)', margin: '0 0 12px' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: accent ?? '#e8e0d4', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.72rem', color: 'rgba(232,224,212,0.3)', marginTop: '8px', marginBottom: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Tooltip grafico ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number}>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '10px', padding: '10px 14px' }}>
      <p style={{ color: 'rgba(232,224,212,0.5)', fontSize: '0.72rem', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: '#c9a96e', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{payload[0].value} visite</p>
    </div>
  )
}

// ─── Modal crea galleria ──────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Gallery) => void }) {
  const [title,    setTitle]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res  = await fetch('/api/admin/galleries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, password }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    onCreated({ ...data, coverThumbUrl: null })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="create-modal-box" style={{ width: '100%', maxWidth: '400px', padding: '40px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', margin: '0 0 28px', fontSize: '1.2rem' }}>Nuova galleria</h2>
        <form onSubmit={submit}>
          {[
            { label: 'Titolo', value: title,    set: setTitle,    ph: 'Es. Matrimonio Rossi 2026' },
            { label: 'Password cliente', value: password, set: setPassword, ph: 'Min. 6 caratteri' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(232,224,212,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>{f.label}</label>
              <input type="text" value={f.value} placeholder={f.ph} required onChange={e => f.set(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#e8e0d4', fontSize: '0.9rem', outline: 'none' }} />
            </div>
          ))}
          {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '14px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(232,224,212,0.5)', cursor: 'pointer', fontSize: '0.85rem' }}>Annulla</button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: '10px', color: '#c9a96e', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
              {loading ? 'Creazione…' : 'Crea galleria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Dashboard principale ─────────────────────────────────────────────────────

export default function DashboardClient({
  galleries: initial,
  analytics,
}: {
  galleries: Gallery[]
  analytics:  Analytics
}) {
  const [galleries, setGalleries] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/studio')
  }

  const mobileCount  = analytics.devices['mobile']  ?? 0
  const desktopCount = analytics.devices['desktop'] ?? 0
  const deviceTotal  = mobileCount + desktopCount || 1
  const mobilePct    = Math.round((mobileCount  / deviceTotal) * 100)
  const desktopPct   = 100 - mobilePct

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e0d4', fontFamily: 'DM Sans, sans-serif' }}>
      <style jsx global>{`
        @media (max-width: 720px) {
          .dash-header { padding: 0 16px !important; gap: 10px !important; }
          .dash-logo { font-size: 0.85rem !important; }
          .dash-nav {
            overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
          }
          .dash-nav::-webkit-scrollbar { display: none; }
          .dash-nav a { padding: 5px 10px !important; font-size: 0.72rem !important; }
          .dash-logout { padding: 5px 10px !important; font-size: 0.72rem !important; }
          .dash-main { padding: 16px !important; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .chart-row { grid-template-columns: 1fr !important; }
          .toppages-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .create-modal-box { padding: 24px !important; }
        }
        @media (max-width: 420px) {
          .metrics-grid { grid-template-columns: 1fr !important; }
          .toppages-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <StudioHeader onLogout={logout} />

      <main className="dash-main" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── Metriche visite ─────────────────────────────────────────── */}
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <MetricCard label="Visite oggi"          value={fmt(analytics.today)} sub="Aggiornato in tempo reale" />
          <MetricCard label="Ultimi 7 giorni"      value={fmt(analytics.week)}  sub="Media: " />
          <MetricCard label="Ultimi 30 giorni"     value={fmt(analytics.month)} accent="#c9a96e" />
          <MetricCard label="Gallerie attive"      value={galleries.filter(g => new Date(g.expiresAt) > new Date()).length} sub={`${galleries.length} totali`} />
        </div>

        {/* ── Riga grafico + performance ──────────────────────────────── */}
        <div className="chart-row" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '24px' }}>

          {/* Grafico visite 30gg */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(232,224,212,0.8)' }}>Visite — ultimi 30 giorni</h3>
              <span style={{ fontSize: '0.72rem', color: 'rgba(232,224,212,0.3)' }}>{analytics.month} totali</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics.dailyViews} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'rgba(232,224,212,0.25)', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => {
                    const parts = v.split('-')
                    return `${parseInt(parts[1])}/${parseInt(parts[0])}`
                  }}
                  interval={6}
                />
                <YAxis tick={{ fill: 'rgba(232,224,212,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(201,169,110,0.2)', strokeWidth: 1 }} />
                <Line
                  type="monotone" dataKey="views" stroke="#c9a96e" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: '#c9a96e', stroke: '#080808', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Performance + Device */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* LCP */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px 24px', flex: 1 }}>
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,224,212,0.35)', margin: '0 0 16px' }}>Performance sito</p>
              {analytics.lcp !== null ? (() => {
                const r = lcpRating(analytics.lcp)
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: r.color, lineHeight: 1 }}>
                        {(analytics.lcp / 1000).toFixed(2)}s
                      </span>
                      <span style={{ fontSize: '0.75rem', color: r.color, marginBottom: '4px', fontWeight: 500 }}>{r.label}</span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(232,224,212,0.3)', margin: 0 }}>
                      LCP medio · {analytics.lcpSamples} misurazioni (7gg)
                    </p>
                    <div style={{ marginTop: '14px', display: 'flex', gap: '6px' }}>
                      {([['< 2.5s', '#4ade80'], ['2.5–4s', '#fbbf24'], ['> 4s', '#f87171']] as const).map(([l, c]) => (
                        <span key={l} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '100px', background: `${c}18`, border: `1px solid ${c}44`, color: c }}>{l}</span>
                      ))}
                    </div>
                  </>
                )
              })() : (
                <p style={{ color: 'rgba(232,224,212,0.3)', fontSize: '0.82rem', margin: 0 }}>
                  Dati non ancora disponibili.<br />
                  <span style={{ fontSize: '0.72rem' }}>Si raccolgono automaticamente dalle visite.</span>
                </p>
              )}
            </div>

            {/* Device split */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px 24px' }}>
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,224,212,0.35)', margin: '0 0 14px' }}>Dispositivi (30gg)</p>
              {[
                { label: '📱 Mobile',  pct: mobilePct,  count: mobileCount },
                { label: '🖥 Desktop', pct: desktopPct, count: desktopCount },
              ].map(d => (
                <div key={d.label} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(232,224,212,0.6)' }}>{d.label}</span>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(232,224,212,0.5)' }}>{d.pct}% · {fmt(d.count)}</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ height: '100%', width: `${d.pct}%`, borderRadius: '100px', background: 'rgba(201,169,110,0.6)', transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Top pagine ──────────────────────────────────────────────── */}
        {analytics.topPages.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px 24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '0.85rem', fontWeight: 600, color: 'rgba(232,224,212,0.8)' }}>Pagine più visitate</h3>
            <div className="toppages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {analytics.topPages.map((p, i) => (
                <div key={p.path} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(232,224,212,0.4)' }}>#{i + 1}</span>
                    <span style={{ fontSize: '0.75rem', color: '#c9a96e', fontWeight: 600 }}>{p.views}</span>
                  </div>
                  <div style={{ height: '3px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ height: '100%', width: `${Math.round((p.views / analytics.topPages[0].views) * 100)}%`, borderRadius: '100px', background: 'rgba(201,169,110,0.5)' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(232,224,212,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.path === '/' || p.path === '/index.html' ? 'Homepage' : p.path}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Gallerie ────────────────────────────────────────────────── */}
        <div id="galleries" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(232,224,212,0.8)' }}>Gallerie clienti</h3>
            <button onClick={() => setShowModal(true)} style={{
              padding: '8px 20px', background: 'rgba(201,169,110,0.12)',
              border: '1px solid rgba(201,169,110,0.35)', borderRadius: '100px',
              color: '#c9a96e', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
            }}>+ Nuova galleria</button>
          </div>

          {galleries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              <p style={{ opacity: 0.3, marginBottom: '16px', fontSize: '0.9rem' }}>Nessuna galleria ancora</p>
              <button onClick={() => setShowModal(true)} style={{ padding: '9px 22px', background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.35)', borderRadius: '100px', color: '#c9a96e', fontSize: '0.82rem', cursor: 'pointer' }}>
                Crea la prima galleria
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
              {galleries.map(g => {
                const badge = expiryBadge(g.expiresAt)
                return (
                  <Link key={g.id} href={`/studio/galleria/${g.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.28)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                      {/* Copertina */}
                      <div style={{ width: '100%', aspectRatio: '16/9', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {g.coverThumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.coverThumbUrl} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <h4 style={{ fontFamily: 'Playfair Display, serif', color: '#e8e0d4', margin: 0, fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{g.title}</h4>
                          <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '100px', background: `${badge.color}18`, border: `1px solid ${badge.color}44`, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                        </div>
                        <p style={{ color: 'rgba(232,224,212,0.35)', fontSize: '0.75rem', margin: 0 }}>{g._count.photos} foto</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={g => setGalleries(prev => [g, ...prev])} />}
    </div>
  )
}
