import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Family Tree',
  description: 'Beautiful family tree powered by Supabase',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  )
}

