'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PasswordForm({
  slug,
  title,
  expired,
}: {
  slug: string
  title: string
  expired: boolean
}) {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res  = await fetch(`/api/gallery/${slug}/auth`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080808', color: '#e8e0d4',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: '20px',
    }}>
      <p style={{
        fontFamily: 'Playfair Display, serif', color: '#c9a96e',
        fontSize: '1rem', letterSpacing: '0.08em', marginBottom: '48px',
      }}>
        Biagio Visconti
      </p>

      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px', padding: '40px',
      }}>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', color: '#e8e0d4',
          fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px',
        }}>
          {title}
        </h1>
        <p style={{ color: 'rgba(232,224,212,0.4)', fontSize: '0.85rem', margin: '0 0 28px' }}>
          {expired
            ? 'Questa galleria è scaduta.'
            : 'Inserisci la password per accedere alla tua galleria.'}
        </p>

        {!expired && (
          <form onSubmit={submit}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', color: '#e8e0d4', fontSize: '0.95rem',
                outline: 'none', marginBottom: '16px',
              }}
            />
            {error && (
              <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(201,169,110,0.15)',
                border: '1px solid rgba(201,169,110,0.4)',
                borderRadius: '10px', color: '#c9a96e',
                fontSize: '0.9rem', fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Accesso…' : 'Accedi alla galleria'}
            </button>
          </form>
        )}

        {expired && (
          <p style={{ color: 'rgba(232,224,212,0.3)', fontSize: '0.82rem', textAlign: 'center', margin: 0 }}>
            Contatta il fotografo per ulteriori informazioni.
          </p>
        )}
      </div>

      <p style={{ marginTop: '40px', color: 'rgba(232,224,212,0.15)', fontSize: '0.78rem' }}>
        © {new Date().getFullYear()} Biagio Visconti
      </p>
    </div>
  )
}
