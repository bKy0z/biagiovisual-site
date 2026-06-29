import type { Metadata } from 'next'

// Layout radice condiviso da /studio e /galleria
// Il sito vetrina (public/index.html) non usa questo layout: è HTML statico.
export const metadata: Metadata = {
  title: 'Biagio Visconti',
  description: 'Fotografia professionale – Napoli',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Font del design system Biagiovisuals */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#080808', color: '#e8e0d4' }}>
        {children}
      </body>
    </html>
  )
}
