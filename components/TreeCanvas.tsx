"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'
import { Search } from 'lucide-react'
import { buildTree, layoutTree } from '@/lib/tree'
import { Marriage, ParentChild, Person, TreeNode } from '@/lib/types'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'
import { useEditMode } from '../lib/edit-mode-context'
import { useRouter } from 'next/navigation'

type Props = {
  people: Person[]
  marriages: Marriage[]
  parentChild: ParentChild[]
}

const NODE_W = 140
const NODE_H = 150

export default function TreeCanvas({ people, marriages, parentChild }: Props) {
  const { nodeById: nodeByIdAll } = useMemo(
    () => buildTree(people, marriages, parentChild),
    [people, marriages, parentChild]
  )

  // state that influences filtering
  const [query, setQuery] = useState('')
  const [collapsedCouples, setCollapsedCouples] = useState<Set<string>>(new Set())
  const [collapsedSingles, setCollapsedSingles] = useState<Set<string>>(new Set())
  const { editMode, setEditMode } = useEditMode()
  const coupleKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const hiddenDescendants = useMemo(() => {
    const hidden = new Set<string>()
    const addSubtree = (id: string) => {
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop() as string
        if (hidden.has(cur)) continue
        hidden.add(cur)
        const kids = nodeByIdAll.get(cur)?.children ?? []
        for (const k of kids) stack.push(k)
        const partners = nodeByIdAll.get(cur)?.partners ?? []
        for (const p of partners) stack.push(p)
      }
    }
    for (const key of collapsedCouples) {
      const [a, b] = key.split('|')
      const children = new Set<string>([
        ...((nodeByIdAll.get(a)?.children) ?? []),
        ...((nodeByIdAll.get(b)?.children) ?? []),
      ])
      for (const c of children) {
        addSubtree(c)
        // Also hide partners of the child (spouses married into the family) and their descendants
        for (const sp of (nodeByIdAll.get(c)?.partners ?? [])) addSubtree(sp)
      }
    }
    // also hide descendants for collapsed singles
    for (const singleId of collapsedSingles) {
      for (const c of (nodeByIdAll.get(singleId)?.children ?? [])) {
        addSubtree(c)
        for (const sp of (nodeByIdAll.get(c)?.partners ?? [])) addSubtree(sp)
      }
    }
    return hidden
  }, [collapsedCouples, collapsedSingles, nodeByIdAll])

  const filtered = useMemo(() => {
    const ids = new Set(people.filter(p => !hiddenDescendants.has(p.id)).map(p => p.id))
    const ppl = people.filter(p => ids.has(p.id))
    const mar = marriages.filter(m => ids.has(m.partner_a) && ids.has(m.partner_b))
    const pc = parentChild.filter(pc => ids.has(pc.parent_id) && ids.has(pc.child_id))
    return { ppl, mar, pc }
  }, [people, marriages, parentChild, hiddenDescendants])

  const { nodeById } = useMemo(
    () => buildTree(filtered.ppl, filtered.mar, filtered.pc),
    [filtered]
  )

  // roots no longer used for layout; keep for API compatibility
  const roots: string[] = []

  const { nodes, positionById } = useMemo(
    () => layoutTree(roots, nodeById, { levelGap: 220, nodeGap: 220, cardWidth: NODE_W, blockMargin: 40 }),
    [roots, nodeById]
  )

  // pan/zoom
  const [scale, setScale] = useState(0.8)
  const [translate, setTranslate] = useState({ x: 300, y: 160 })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Helpers to compute Gen 1 collapse sets
  const computeGen1CollapseSets = useMemo(() => {
    const gen1Ids = new Set(
      Array.from(nodeByIdAll.values())
        .filter((n) => (n.generation ?? 0) === 1)
        .map((n) => n.id)
    )
    const coupleKeys = new Set<string>()
    for (const m of marriages) {
      if (gen1Ids.has(m.partner_a) && gen1Ids.has(m.partner_b)) {
        coupleKeys.add(coupleKey(m.partner_a, m.partner_b))
      }
    }
    const singleIds = new Set<string>()
    for (const n of nodeByIdAll.values()) {
      if ((n.generation ?? 0) !== 1) continue
      const hasPartner = (n.partners?.length ?? 0) > 0
      const hasChildren = (n.children?.length ?? 0) > 0
      if (!hasPartner && hasChildren) singleIds.add(n.id)
    }
    return { coupleKeys, singleIds }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeByIdAll, marriages])

  // Apply Popo's branch default collapse ONCE at start: keep Bao Hue Chau + To Dung Tran branch open
  const initialCollapseApplied = useRef(false)
  useEffect(() => {
    if (initialCollapseApplied.current) return
    const normalize = (s: string | null | undefined) => (s ?? '').toLowerCase().trim()
    const findByName = (first: string, last: string) => {
      const f = normalize(first)
      const l = normalize(last)
      const match = Array.from(nodeByIdAll.values()).find(
        (n) => normalize(n.first_name || n.preferred_name) === f && normalize(n.last_name) === l
      )
      return match?.id || null
    }
    const idDung = findByName('to dung', 'tran')
    const idBaoHue = findByName('bao hue', 'chau')
    const { coupleKeys, singleIds } = computeGen1CollapseSets
    const keepKey = idDung && idBaoHue ? coupleKey(idDung, idBaoHue) : null
    const nextCouples = new Set<string>()
    for (const key of coupleKeys) {
      if (keepKey && key === keepKey) continue
      nextCouples.add(key)
    }
    const nextSingles = new Set(singleIds)
    setCollapsedCouples(nextCouples)
    setCollapsedSingles(nextSingles)
    initialCollapseApplied.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeByIdAll, marriages])

  const collapseAllGen1 = () => {
    const { coupleKeys, singleIds } = computeGen1CollapseSets
    setCollapsedCouples(new Set(coupleKeys))
    setCollapsedSingles(new Set(singleIds))
  }
  const expandAll = () => {
    setCollapsedCouples(new Set())
    setCollapsedSingles(new Set())
  }
  const allGen1Collapsed = useMemo(() => {
    const { coupleKeys, singleIds } = computeGen1CollapseSets
    for (const k of coupleKeys) if (!collapsedCouples.has(k)) return false
    for (const s of singleIds) if (!collapsedSingles.has(s)) return false
    return true
  }, [computeGen1CollapseSets, collapsedCouples, collapsedSingles])
  
  const isChildOfCollapsedCouple = (childId: string) => {
    const parents = nodeById.get(childId)?.parents ?? []
    if (parents.length < 2) return false
    const [p1, p2] = parents
    const key = coupleKey(p1, p2)
    return collapsedCouples.has(key)
  }
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  const onWheel = (e: React.WheelEvent) => {
    const next = Math.min(2, Math.max(0.3, scale - e.deltaY * 0.001))
    setScale(next)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => {
    dragging.current = false
  }

  // search and center
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as TreeNode[]
    return Array.from(nodeById.values()).filter((n) =>
      `${n.preferred_name ?? n.first_name ?? ''} ${n.last_name ?? ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [query, nodeById])

  const centerOn = (id: string, zoom?: number) => {
    const pos = positionById.get(id)
    if (!pos) return
    const targetScale = typeof zoom === 'number' ? Math.max(0.3, Math.min(2, zoom)) : scale
    setScale(targetScale)
    const viewport = { w: window.innerWidth, h: window.innerHeight }
    setTranslate({ x: viewport.w / 2 - pos.x * targetScale, y: viewport.h / 2 - pos.y * targetScale })
  }

  // toggle collapse state for all couple pairings of a person
  const toggleCollapseForPerson = (personId: string) => {
    // Use full dataset for partner lookup so behavior is consistent with filters
    const partners = nodeByIdAll.get(personId)?.partners ?? []
    if (partners.length === 0) {
      // toggle single-parent collapse
      setCollapsedSingles((prev) => {
        const next = new Set(prev)
        if (next.has(personId)) next.delete(personId)
        else next.add(personId)
        return next
      })
      return
    }
    setCollapsedCouples((prev) => {
      const next = new Set(prev)
      const allPairsCollapsed = partners.every((mateId) => next.has(coupleKey(personId, mateId)))
      for (const mateId of partners) {
        const key = coupleKey(personId, mateId)
        if (allPairsCollapsed) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  const fitToView = () => {
    if (nodes.length === 0) return
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs) - NODE_W / 2
    const maxX = Math.max(...xs) + NODE_W / 2
    const minY = Math.min(...ys) - NODE_H / 2
    const maxY = Math.max(...ys) + NODE_H / 2
    const width = maxX - minX
    const height = maxY - minY
    const vw = window.innerWidth - (sidebarOpen ? 320 : 0) // account for sidebar width
    const vh = window.innerHeight - 40
    const s = Math.min(2, Math.max(0.3, Math.min(vw / width, vh / height) * 0.9))
    setScale(s)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    setTranslate({ x: vw / 2 + (sidebarOpen ? 320 : 0) / 2 - centerX * s, y: vh / 2 - centerY * s })
  }

  // modal state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [form, setForm] = useState<Partial<Person>>({})
  useEffect(() => {
    if (!selected) return
    setForm({
      first_name: selected.first_name ?? '',
      last_name: selected.last_name ?? '',
      preferred_name: selected.preferred_name ?? '',
      gender: selected.gender ?? null,
      birth_date: selected.birth_date ?? '',
      birth_place: selected.birth_place ?? '',
      death_date: selected.death_date ?? '',
      death_place: selected.death_place ?? '',
      status: selected.status ?? null,
      phone: selected.phone ?? '',
      facebook: selected.facebook ?? '',
      photo: selected.photo ?? '',
      generation: selected.generation ?? null,
    })
  }, [selected])

  const handleSave = async () => {
    if (!selected) return
    const updatePayload: any = { ...form }
    try {
      await supabase.from('people').update(updatePayload).eq('id', selected.id)
      setSelectedId(null)
      router.refresh()
    } catch (e) {
      console.error(e)
    }
  }

  // create person modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<Person>>({ gender: null, status: 'Living' as any })
  const [parentFather, setParentFather] = useState<string | ''>('')
  const [parentMother, setParentMother] = useState<string | ''>('')
  const [partnerSelection, setPartnerSelection] = useState<string | ''>('')
  const allPeople = useMemo(() => Array.from(nodeById.values()), [nodeById])

  const handleCreate = async () => {
    try {
      // insert into people
      const { data, error } = await supabase.from('people').insert({
        ...createForm,
      }).select().single()
      if (error) throw error
      const newId = data.id as string
      // parent_child rows
      if (parentFather) await supabase.from('parent_child').insert({ parent_id: parentFather, child_id: newId })
      if (parentMother) await supabase.from('parent_child').insert({ parent_id: parentMother, child_id: newId })
      // marriage row
      if (partnerSelection) {
        await supabase.from('marriages').insert({ partner_a: newId, partner_b: partnerSelection })
      }
      setShowCreate(false)
      setParentFather('')
      setParentMother('')
      setPartnerSelection('')
      setCreateForm({})
      router.refresh()
    } catch (e) {
      console.error(e)
    }
  }

  // close on Escape when modal open
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  useEffect(() => {
    if (nodes.length > 0) {
      fitToView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length])

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
      <aside className="w-80 border-r border-slate-800 bg-slate-900/70 glass p-4 space-y-4 overflow-y-auto relative">
        <div className="flex items-center gap-2 sticky top-0 bg-slate-900/90 py-2 z-10">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            className="w-full rounded-md bg-slate-800/70 border border-slate-700 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring"
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Controls row 1 */}
        <div className="sticky top-14 flex items-center gap-2 z-10 bg-slate-900/90 py-2">
          {/* Popo's branch toggle removed; default collapse applied on load */}
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
            <input type="checkbox" checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} /> Edit mode
          </label>
        </div>
        {/* Controls row 2 */}
        <div className="sticky top-24 flex items-center gap-2 z-10 bg-slate-900/90 py-2">
          <button className="rounded bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1" onClick={() => setScale((s)=>Math.min(2, s+0.1))}>+</button>
          <button className="rounded bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1" onClick={() => setScale((s)=>Math.max(0.3, s-0.1))}>-</button>
          <button className="rounded bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1" onClick={fitToView}>Reset</button>
          <button className="rounded bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1" onClick={() => { allGen1Collapsed ? expandAll() : collapseAllGen1() }}>{allGen1Collapsed ? 'Expand all' : 'Collapse all'}</button>
          <button className="ml-auto rounded bg-blue-600 hover:bg-blue-500 text-white px-3 py-1" onClick={()=>setShowCreate(true)}>Add person</button>
        </div>

        {/* Grouped by generation */}
        {Array.from(new Set(people.map((p) => p.generation ?? 0))).sort((a,b) => a-b).map((g) => {
          const ids = people
            .filter((p) => (p.generation ?? 0) === g)
            .sort((a,b) => {
              const keyA = (nodeById.get(a.id)?.parents ?? []).slice().sort().join('|')
              const keyB = (nodeById.get(b.id)?.parents ?? []).slice().sort().join('|')
              const hasParentsA = (nodeById.get(a.id)?.parents?.length ?? 0) > 0 ? 0 : 1
              const hasParentsB = (nodeById.get(b.id)?.parents?.length ?? 0) > 0 ? 0 : 1
              if (hasParentsA !== hasParentsB) return hasParentsA - hasParentsB
              if (keyA !== keyB) return keyA.localeCompare(keyB)
              const ra = a.birth_date != null ? parseInt(String(a.birth_date),10) : Number.MAX_SAFE_INTEGER
              const rb = b.birth_date != null ? parseInt(String(b.birth_date),10) : Number.MAX_SAFE_INTEGER
              return ra - rb
            })
            .map((p)=>p.id)
          return (
            <div key={g} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-slate-400">Generation {g}</div>
              </div>
              {ids.map((id) => {
                const m = nodeById.get(id)
                if (!m) return null
                const name = (m.preferred_name || m.first_name || '') + ' ' + (m.last_name || '')
                if (query && !name.toLowerCase().includes(query.toLowerCase())) return null
                return (
                  <button key={id} className="w-full flex items-center gap-3 rounded px-2 py-2 hover:bg-slate-800/70" onClick={() => { centerOn(id, 1.2); if (editMode) setSelectedId(id) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.photo ? <img src={m.photo} alt={name} className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-slate-700 grid place-items-center">👤</div>}
                    <div className="flex-1">
                      <div className="text-sm text-slate-100">{name}</div>
                      <div className="text-[11px] text-slate-400">{m.status ?? 'Unknown'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}

        <div className="text-xs text-gray-500 mt-4">
          Tip: drag to pan, scroll to zoom. Click a name to center.
        </div>
      </aside>
      )}

      <main className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-950">
        <button className="absolute left-2 top-2 z-50 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold px-3 py-1 shadow-lg ring-2 ring-white/40"
          onClick={()=>{ setSidebarOpen(v=>!v); setTimeout(fitToView, 50) }}>
          {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        </button>
        <svg
          className="absolute inset-0 w-full h-full"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/>
            </marker>
          </defs>
          <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
            {/* edges for parent-child with marriage centroid routing */}
            {(() => {
              const marriedPairs = new Set<string>()
              for (const m of filtered.mar) {
                const a = m.partner_a < m.partner_b ? m.partner_a : m.partner_b
                const b = m.partner_a < m.partner_b ? m.partner_b : m.partner_a
                marriedPairs.add(`${a}|${b}`)
              }
              const childToParents = new Map<string, Set<string>>()
              for (const pc of parentChild) {
                if (!childToParents.has(pc.child_id)) childToParents.set(pc.child_id, new Set())
                childToParents.get(pc.child_id)!.add(pc.parent_id)
              }
              const edges: { key: string; x1: number; y1: number; x2: number; y2: number }[] = []
              const handled = new Set<string>() // child ids handled via centroid
              for (const [childId, parents] of childToParents) {
                if (isChildOfCollapsedCouple(childId)) { handled.add(childId); continue }
                const plist = Array.from(parents)
                if (plist.length >= 2) {
                  // consider first two parents only
                  const p1 = plist[0]
                  const p2 = plist[1]
                  const a = p1 < p2 ? p1 : p2
                  const b = p1 < p2 ? p2 : p1
                  if (marriedPairs.has(`${a}|${b}`)) {
                    const pa = positionById.get(a)
                    const pb = positionById.get(b)
                    const c = positionById.get(childId)
                    if (pa && pb && c) {
                      const x1 = (pa.x + pb.x) / 2
                      const y1 = Math.max(pa.y, pb.y) + NODE_H / 2
                      const x2 = c.x
                      const y2 = c.y - NODE_H / 2
                      edges.push({ key: `${a}-${b}-${childId}`, x1, y1, x2, y2 })
                      handled.add(childId)
                    }
                  }
                }
              }
              for (const pc of parentChild) {
                if (isChildOfCollapsedCouple(pc.child_id)) continue
                if (handled.has(pc.child_id)) continue
                const p = positionById.get(pc.parent_id)
                const c = positionById.get(pc.child_id)
                if (!p || !c) continue
                const x1 = p.x
                const y1 = p.y + NODE_H / 2
                const x2 = c.x
                const y2 = c.y - NODE_H / 2
                edges.push({ key: pc.id, x1, y1, x2, y2 })
              }
              return edges.map((e) => (
                <path
                  key={e.key}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`}
                  stroke="#475569"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              ))
            })()}

            {/* edges for marriages */}
            {filtered.mar.map((m) => {
              const a = positionById.get(m.partner_a)
              const b = positionById.get(m.partner_b)
              if (!a || !b) return null
              const y = a.y
              return (
                <path
                  key={m.id}
                  d={`M ${a.x + NODE_W / 2} ${y} L ${b.x - NODE_W / 2} ${y}`}
                  stroke="#fb7185"
                  strokeWidth="3.5"
                  fill="none"
                  strokeDasharray="6 6"
                />
              )
            })}

            {/* generation guides */}
            {(() => {
              const gens = Array.from(new Set(nodes.map((n) => n.depth))).sort((a,b)=>a-b)
              const leftX = Math.min(...nodes.map((n)=>n.x)) - 200
              const rightX = Math.max(...nodes.map((n)=>n.x)) + 200
              return gens.map((g) => {
                const y = g * 220
                return (
                  <g key={g}>
                    <line x1={leftX} y1={y} x2={rightX} y2={y} stroke="#1f2937" strokeDasharray="6 10" strokeWidth={2} />
                    <rect x={leftX} y={y-20} width={120} height={28} rx={8} fill="#0f172a" stroke="#1f2937" />
                    <text x={leftX+60} y={y-2} fill="#e2e8f0" fontSize={12} textAnchor="middle">Generation {g}</text>
                  </g>
                )
              })
            })()}

            {/* nodes */}
            {Array.from(new Map(nodes.map(n => [n.id, n])).values()).filter(n => !isChildOfCollapsedCouple(n.id)).map((n) => {
              const person = nodeById.get(n.id)!
              const color = person.gender === 'M' ? 'bg-male/90' : person.gender === 'F' ? 'bg-female/90' : 'bg-neutral/80'
              const statusLower = (person.status || '').toLowerCase()
              const statusColor = statusLower === 'deceased' ? 'text-deceased' : statusLower === 'living' ? 'text-living' : 'text-slate-300'
              const x = n.x - NODE_W / 2
              const y = n.y - NODE_H / 2
              return (
                <foreignObject key={n.id} x={x} y={y} width={NODE_W} height={NODE_H}>
                  <div className={clsx('rounded-2xl shadow-card text-white flex flex-col items-center justify-center h-full px-3 py-2 cursor-pointer relative', color)} onClick={() => { if (editMode) { setSelectedId(n.id) } else { toggleCollapseForPerson(n.id) } }}>
                    <div className="relative mb-2">
                      {person.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.photo} alt={person.first_name ?? ''} className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-black/20 grid place-items-center text-2xl">👤</div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-semibold leading-4">
                        {person.preferred_name || person.first_name} {person.last_name}
                      </div>
                      <div className={clsx('text-[10px] opacity-90', statusColor)}>
                        {(person.status ? String(person.status).toLowerCase() : 'unknown')}
                      </div>
                      <div className="flex items-center justify-center gap-2 mt-1 text-white/90">
                        {person.children.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px]">
                            <span role="img" aria-label="children">👶</span> {person.children.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </foreignObject>
              )
            })}


            {/* detail modal rendered outside SVG for stability */}
            
          </g>
        </svg>
        {/* modal overlay */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => setSelectedId(null)}>
            <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800 w-[800px] max-w-[95vw]" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center gap-4 p-5 border-b border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {selected.photo ? <img src={selected.photo} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"/> : <div className="h-20 w-20 rounded-full bg-slate-700 grid place-items-center">👤</div>}
                <div className="flex-1">
                  <div className="text-xl font-semibold">{selected.preferred_name || selected.first_name} {selected.last_name}</div>
                  <div className="text-sm text-slate-400 capitalize">{(selected.status||'').toString()}</div>
                </div>
                <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=>setSelectedId(null)}>Close</button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400">First name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.first_name as string || ''}
                      onChange={(e)=>setForm(f=>({...f, first_name:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Last name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.last_name as string || ''}
                      onChange={(e)=>setForm(f=>({...f, last_name:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Preferred name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.preferred_name as string || ''}
                      onChange={(e)=>setForm(f=>({...f, preferred_name:e.target.value}))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Gender</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={(form.gender as string) || ''}
                        onChange={(e)=>setForm(f=>({...f, gender: e.target.value as any}))}
                      >
                        <option value="">—</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Status</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={(form.status as string) || ''}
                        onChange={(e)=>setForm(f=>({...f, status: e.target.value as any}))}
                      >
                        <option value="">—</option>
                        <option value="Living">Living</option>
                        <option value="Deceased">Deceased</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Birth date</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={form.birth_date as string || ''}
                        onChange={(e)=>setForm(f=>({...f, birth_date:e.target.value}))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Birth place</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={form.birth_place as string || ''}
                        onChange={(e)=>setForm(f=>({...f, birth_place:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Death date</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={form.death_date as string || ''}
                        onChange={(e)=>setForm(f=>({...f, death_date:e.target.value}))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Death place</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={form.death_place as string || ''}
                        onChange={(e)=>setForm(f=>({...f, death_place:e.target.value}))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400">Phone</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.phone as string || ''}
                      onChange={(e)=>setForm(f=>({...f, phone:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Facebook</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.facebook as string || ''}
                      onChange={(e)=>setForm(f=>({...f, facebook:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Photo URL</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={form.photo as string || ''}
                      onChange={(e)=>setForm(f=>({...f, photo:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Generation</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={String(form.generation ?? '')}
                      onChange={(e)=>setForm(f=>({...f, generation: e.target.value ? parseInt(e.target.value,10) : null}))}
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={handleSave}>Save</button>
                    <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700" onClick={()=>setSelectedId(null)}>Cancel</button>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-2">Family</div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <svg width="100%" height="240" viewBox="0 0 640 240">
                    {(() => {
                      const parents = (selected.parents ?? []).map((id)=>nodeById.get(id)).filter(Boolean) as TreeNode[]
                      const spouses = (selected.partners ?? []).map((id)=>nodeById.get(id)).filter(Boolean) as TreeNode[]
                      const children = (selected.children ?? []).map((id)=>nodeById.get(id)).filter(Boolean) as TreeNode[]
                      const parentY = 30, meY = 120, spouseY = 120, childY = 210
                      const parentXs = parents.map((_,i)=> 160 + i*(parents.length>1?320:0))
                      const meX = 320
                      const spouseXs = spouses.map((_,i)=> 320 + (i+1)*140)
                      const childXs = children.length>1 ? children.map((_,i)=> 100 + i*(440/(children.length-1))) : [320]
                      const nodes: JSX.Element[] = []
                      parents.forEach((p,idx)=>{
                        nodes.push(
                          <text key={`pt-${p.id}`} x={parentXs[idx]} y={parentY} textAnchor="middle" fontSize={12} fill="#e2e8f0">{(p.preferred_name||p.first_name)} {(p.last_name||'')}</text>
                        )
                        nodes.push(
                          <path key={`p-line-${p.id}`} d={`M ${parentXs[idx]} ${parentY+6} L ${meX} ${meY-14}`} stroke="#64748b" />
                        )
                      })
                      nodes.push(
                        <circle key="me" cx={meX} cy={meY} r={12} fill="#38bdf8" />
                      )
                      nodes.push(
                        <text key="me-t" x={meX} y={meY+28} textAnchor="middle" fontSize={12} fill="#e2e8f0">{(selected.preferred_name||selected.first_name)} {(selected.last_name||'')}</text>
                      )
                      spouses.forEach((s,idx)=>{
                        nodes.push(
                          <circle key={`sp-${s.id}`} cx={spouseXs[idx]} cy={spouseY} r={10} fill="#f472b6"/>
                        )
                        nodes.push(
                          <path key={`m-${s.id}`} d={`M ${meX+12} ${meY} L ${spouseXs[idx]-12} ${spouseY}`} stroke="#fb7185" strokeDasharray="6 4"/>
                        )
                      })
                      children.forEach((c,idx)=>{
                        nodes.push(
                          <text key={`ch-${c.id}`} x={childXs[idx]} y={childY} textAnchor="middle" fontSize={12} fill="#e2e8f0">{(c.preferred_name||c.first_name)} {(c.last_name||'')}</text>
                        )
                        nodes.push(
                          <path key={`c-line-${c.id}`} d={`M ${meX} ${meY+14} L ${childXs[idx]} ${childY-14}`} stroke="#64748b"/>
                        )
                      })
                      return nodes
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* create person modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50" onClick={() => setShowCreate(false)}>
            <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800 w-[820px] max-w-[95vw]" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="text-lg font-semibold">Add new person</div>
                <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={()=>setShowCreate(false)}>Close</button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400">First name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={createForm.first_name as string || ''}
                      onChange={(e)=>setCreateForm(f=>({...f, first_name:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Last name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={createForm.last_name as string || ''}
                      onChange={(e)=>setCreateForm(f=>({...f, last_name:e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Preferred name</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={createForm.preferred_name as string || ''}
                      onChange={(e)=>setCreateForm(f=>({...f, preferred_name:e.target.value}))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Gender</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={(createForm.gender as string) || ''}
                        onChange={(e)=>setCreateForm(f=>({...f, gender: e.target.value as any}))}
                      >
                        <option value="">—</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Status</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={(createForm.status as string) || ''}
                        onChange={(e)=>setCreateForm(f=>({...f, status: e.target.value as any}))}
                      >
                        <option value="">—</option>
                        <option value="Living">Living</option>
                        <option value="Deceased">Deceased</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Birth date</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={createForm.birth_date as string || ''}
                        onChange={(e)=>setCreateForm(f=>({...f, birth_date:e.target.value}))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Birth place</label>
                      <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={createForm.birth_place as string || ''}
                        onChange={(e)=>setCreateForm(f=>({...f, birth_place:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Photo URL</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={createForm.photo as string || ''}
                      onChange={(e)=>setCreateForm(f=>({...f, photo:e.target.value}))}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400">Generation</label>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={String(createForm.generation ?? '')}
                      onChange={(e)=>setCreateForm(f=>({...f, generation: e.target.value ? parseInt(e.target.value,10) : null}))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400">Father (optional)</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={parentFather}
                        onChange={(e)=>setParentFather(e.target.value)}
                      >
                        <option value="">—</option>
                        {allPeople.map(p=> (
                          <option key={p.id} value={p.id}>{(p.preferred_name||p.first_name)} {(p.last_name||'')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400">Mother (optional)</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                        value={parentMother}
                        onChange={(e)=>setParentMother(e.target.value)}
                      >
                        <option value="">—</option>
                        {allPeople.map(p=> (
                          <option key={p.id} value={p.id}>{(p.preferred_name||p.first_name)} {(p.last_name||'')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400">Partner (optional)</label>
                    <select className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                      value={partnerSelection}
                      onChange={(e)=>setPartnerSelection(e.target.value)}
                    >
                      <option value="">—</option>
                      {allPeople.map(p=> (
                        <option key={p.id} value={p.id}>{(p.preferred_name||p.first_name)} {(p.last_name||'')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={handleCreate}>Create</button>
                    <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700" onClick={()=>setShowCreate(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

