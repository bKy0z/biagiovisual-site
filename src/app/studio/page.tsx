import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/session'
import LoginForm from './LoginForm'

export const metadata = {
  title:  'Studio — Biagiovisuals',
  robots: 'noindex',
}

export default async function StudioPage() {
  // Se già autenticato, salta direttamente alla dashboard
  const session = await getAdminSession()
  if (session) redirect('/studio/dashboard')

  return <LoginForm />
}
