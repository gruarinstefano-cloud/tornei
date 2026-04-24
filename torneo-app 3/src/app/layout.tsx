import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tornei di Calcio',
  description: 'Gestione tornei di calcio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
