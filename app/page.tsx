import TreeCanvas from '@/components/TreeCanvas'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Marriage, ParentChild, Person } from '@/lib/types'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [peopleRes, marriagesRes, pcRes] = await Promise.all([
    supabase.from('people').select('*').returns<Person[]>(),
    supabase.from('marriages').select('*').returns<Marriage[]>(),
    supabase.from('parent_child').select('*').returns<ParentChild[]>(),
  ])

  const people = peopleRes.data ?? []
  const marriages = marriagesRes.data ?? []
  const parentChild = pcRes.data ?? []

  return (
    <div className="relative">
      <TreeCanvas people={people} marriages={marriages} parentChild={parentChild} />
      {/* Modal portal container */}
      <div id="modal-root" className="fixed inset-0 pointer-events-none" />
    </div>
  )
}

