"use client"
import { useEffect, useState } from 'react'
import TreeCanvas from '@/components/TreeCanvas'
import { createClient } from '@/utils/supabase/client'
import { Marriage, ParentChild, Person } from '@/lib/types'

export default function Page() {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [marriages, setMarriages] = useState<Marriage[] | null>(null)
  const [parentChild, setParentChild] = useState<ParentChild[] | null>(null)

  useEffect(() => {
    const load = async () => {
      if (process.env.NEXT_PUBLIC_USE_JSON_FALLBACK === 'true' || process.env.USE_JSON_FALLBACK === 'true') {
        try {
          const res = await fetch('/data/sample.json', { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            setPeople(json.people || [])
            setMarriages(json.marriages || [])
            setParentChild(json.parent_child || [])
            return
          }
        } catch {}
      }
      const supabase = createClient()
      const [peopleRes, marriagesRes, pcRes] = await Promise.all([
        supabase.from('people').select('*').returns<Person[]>(),
        supabase.from('marriages').select('*').returns<Marriage[]>(),
        supabase.from('parent_child').select('*').returns<ParentChild[]>(),
      ])
      setPeople(peopleRes.data ?? [])
      setMarriages(marriagesRes.data ?? [])
      setParentChild(pcRes.data ?? [])
    }
    load()
  }, [])

  if (!people || !marriages || !parentChild) {
    return <div className="min-h-screen grid place-items-center text-slate-300">Loading…</div>
  }

  return (
    <div className="relative">
      <TreeCanvas people={people} marriages={marriages} parentChild={parentChild} />
      <div id="modal-root" className="fixed inset-0 pointer-events-none" />
    </div>
  )
}

