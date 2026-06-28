import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      fontFamily: 'DM Sans, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      color: '#e8e0d4',
    }}>
      <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#c9a96e', fontSize: '4rem', margin: 0 }}>
        404
      </h1>
      <p style={{ opacity: 0.6, margin: 0 }}>Pagina non trovata</p>
      <Link href="/" style={{ color: '#c9a96e', textDecoration: 'none', fontSize: '0.9rem' }}>
        ← Torna alla home
      </Link>
    </div>
  )
}
