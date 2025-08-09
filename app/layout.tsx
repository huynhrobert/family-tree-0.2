import './globals.css'
import { ReactNode } from 'react'
import { EditModeProvider } from '@/lib/edit-mode-context'
import AuthGate from '@/components/AuthGate'

export const metadata = {
  title: 'Family Tree',
  description: 'Beautiful family tree powered by Supabase',
  robots: { index: false, follow: false }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100">
        {/* inline favicon to avoid 404 during dev */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🌳</text></svg>" />
        <EditModeProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </EditModeProvider>
      </body>
    </html>
  )
}

