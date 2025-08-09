"use client"
import { ReactNode, useEffect, useState } from 'react'

const base = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/family-tree-0.2' : '')

export default function AuthGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const authCookie = document.cookie.includes('ft_auth=ok')
    const pathname = window.location.pathname
    const authPath = `${base}/auth/`
    if (pathname.startsWith(authPath) || authCookie) {
      setAllowed(true)
    } else {
      window.location.replace(authPath)
    }
  }, [])

  if (!allowed) return null
  return <>{children}</>
}


