import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Markdown Todo - IndexedDB Edition',
  description: 'A local-first todo app powered by IndexedDB',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        <AuthProvider>
          <div className="aurora-bg">
            <div className="aurora-blob blob-1"></div>
            <div className="aurora-blob blob-2"></div>
            <div className="aurora-blob blob-3"></div>
          </div>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
