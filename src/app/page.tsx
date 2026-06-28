import { redirect } from 'next/navigation'

// Il middleware riscrive "/" → "/index.html" (sito statico).
// Questo fallback si attiva solo se il middleware non intercetta la richiesta.
export default function HomePage() {
  redirect('/index.html')
}
