"use client"
import { useState } from 'react'

export default function AuthPage() {
  const [pwd, setPwd] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd === 'H3lloF4mily!') {
      document.cookie = `ft_auth=ok; path=/; max-age=${60 * 60 * 24 * 30}`
      window.location.href = (process.env.NODE_ENV === 'production' ? '/family-tree-0.2/' : '/')
    } else {
      alert('Incorrect password')
    }
  }
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900 text-slate-100">
      <form onSubmit={submit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl w-[320px]">
        <div className="text-lg font-semibold mb-4">Family Tree Access</div>
        <input type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} placeholder="Enter password"
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 mb-3" />
        <button type="submit" className="w-full rounded bg-blue-600 hover:bg-blue-500 px-3 py-2">Enter</button>
      </form>
    </div>
  )
}


