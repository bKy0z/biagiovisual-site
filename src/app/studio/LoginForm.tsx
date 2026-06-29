'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/studio/dashboard')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Errore di accesso')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     '#080808',
      fontFamily:     'DM Sans, sans-serif',
    }}>
      <div style={{
        width:          '100%',
        maxWidth:       '380px',
        padding:        '48px 40px',
        background:     'rgba(255,255,255,0.03)',
        border:         '1px solid rgba(255,255,255,0.08)',
        borderRadius:   '24px',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{
            fontFamily:  'Playfair Display, Georgia, serif',
            fontSize:    '1.6rem',
            fontWeight:  700,
            color:       '#c9a96e',
            margin:      0,
            letterSpacing: '-0.02em',
          }}>
            Biagio Visconti
          </h1>
          <p style={{ color: 'rgba(232,224,212,0.45)', fontSize: '0.8rem', marginTop: '6px' }}>
            Pannello di controllo
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'rgba(232,224,212,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            required
            disabled={loading}
            style={{
              width:        '100%',
              padding:      '12px 16px',
              background:   'rgba(255,255,255,0.05)',
              border:       '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color:        '#e8e0d4',
              fontSize:     '0.95rem',
              outline:      'none',
              boxSizing:    'border-box',
              marginBottom: '16px',
            }}
            placeholder="••••••••"
          />

          {error && (
            <p style={{
              color:        '#f87171',
              fontSize:     '0.82rem',
              marginBottom: '16px',
              padding:      '10px 14px',
              background:   'rgba(248,113,113,0.08)',
              borderRadius: '8px',
              border:       '1px solid rgba(248,113,113,0.2)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width:        '100%',
              padding:      '12px',
              background:   loading ? 'rgba(201,169,110,0.4)' : 'rgba(201,169,110,0.15)',
              border:       '1px solid rgba(201,169,110,0.4)',
              borderRadius: '10px',
              color:        '#c9a96e',
              fontSize:     '0.9rem',
              fontWeight:   500,
              cursor:       loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
              transition:   'all 0.2s',
            }}
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
