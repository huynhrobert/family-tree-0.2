import { Marriage, ParentChild, Person, TreeNode } from './types'

export function buildTree(
  people: Person[],
  marriages: Marriage[],
  parentChild: ParentChild[]
) {
  const personById = new Map(people.map((p) => [p.id, p]))

  const nodeById = new Map<string, TreeNode>()
  for (const person of people) {
    nodeById.set(person.id, {
      ...person,
      children: [],
      partners: [],
    })
  }

  for (const m of marriages) {
    nodeById.get(m.partner_a)?.partners.push(m.partner_b)
    nodeById.get(m.partner_b)?.partners.push(m.partner_a)
  }

  for (const pc of parentChild) {
    nodeById.get(pc.parent_id)?.children.push(pc.child_id)
    const child = nodeById.get(pc.child_id)
    if (child) {
      if (!child.parents) child.parents = []
      child.parents.push(pc.parent_id)
    }
  }

  return { nodeById, personById }
}

export type PositionedNode = {
  id: string
  x: number
  y: number
  depth: number
}

// Simple tidy tree layout for up to 6 generations.
// Left-to-right layout using `generation` for X, keeping partners adjacent in each generation.
export function layoutTree(
  _roots: string[],
  nodeById: Map<string, TreeNode>,
  options?: { levelGap?: number; nodeGap?: number; cardWidth?: number; blockMargin?: number; collapsedCouples?: Set<string> }
) {
  // Top-down: Y encodes generation, X orders within generation
  const levelGap = options?.levelGap ?? 220 // Y distance between generations
  const blockGapDefault = options?.nodeGap ?? 260 // default spacing if not using variable width
  const partnerHorizGap = 150 // Horizontal gap between partners when side-by-side
  const cardWidth = options?.cardWidth ?? 140
  const blockMargin = options?.blockMargin ?? 30

  // Normalize spouse generations: ensure all married partners share the min generation within their marriage component
  const genById = new Map<string, number>()
  for (const [id, n] of nodeById) genById.set(id, (n.generation ?? 0) | 0)
  const adj = new Map<string, string[]>()
  for (const n of nodeById.values()) {
    for (const p of n.partners) {
      if (!adj.has(n.id)) adj.set(n.id, [])
      if (!adj.has(p)) adj.set(p, [])
      adj.get(n.id)!.push(p)
      adj.get(p)!.push(n.id)
    }
  }
  const seenComp = new Set<string>()
  for (const id of nodeById.keys()) {
    if (seenComp.has(id)) continue
    const stack = [id]
    seenComp.add(id)
    const comp: string[] = []
    while (stack.length) {
      const cur = stack.pop()!
      comp.push(cur)
      for (const nb of adj.get(cur) ?? []) {
        if (!seenComp.has(nb)) {
          seenComp.add(nb)
          stack.push(nb)
        }
      }
    }
    const minGen = Math.min(...comp.map((pid) => genById.get(pid) ?? 0))
    for (const pid of comp) genById.set(pid, minGen)
  }

  // Group by generation; if none, infer 0
  const genToIds = new Map<number, string[]>()
  for (const [id] of nodeById) {
    const g = genById.get(id) ?? 0
    if (!genToIds.has(g)) genToIds.set(g, [])
    genToIds.get(g)!.push(id)
  }
  const generations = Array.from(genToIds.keys()).sort((a, b) => a - b)
  // Place generation by generation (top-down)
  const positionById = new Map<string, PositionedNode>()
  type Block = { ids: string[]; rank: number; parentsKey: string; weight: number }

  const getBirthRank = (id: string) => {
    const bd = nodeById.get(id)?.birth_date ?? null
    const n = bd !== null ? parseInt(String(bd), 10) : Number.MAX_SAFE_INTEGER
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
  }

  const parentAverageX = (ids: string[]): number => {
    const parentIds = new Set<string>()
    for (const id of ids) (nodeById.get(id)?.parents ?? []).forEach((p) => parentIds.add(p))
    const xs = Array.from(parentIds).map((pid) => positionById.get(pid)?.x).filter((v): v is number => typeof v === 'number')
    if (xs.length === 0) return 0
    return xs.reduce((a, b) => a + b, 0) / xs.length
  }

  for (const g of generations) {
    const y = g * levelGap
    const ids = genToIds.get(g)!

    // Build blocks: couple or single
    const seen = new Set<string>()
    const blocks: Block[] = []
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const partner = (nodeById.get(id)?.partners ?? []).find((p) => (genById.get(p) ?? 0) === g)
      if (partner && !seen.has(partner)) {
        seen.add(partner)
        const a = nodeById.get(id)!
        const b = nodeById.get(partner)!
        const maleId = a.gender === 'M' ? a.id : b.gender === 'M' ? b.id : a.id
        const femaleId = a.id === maleId ? b.id : a.id
        const collapsedKey = maleId < femaleId ? `${maleId}|${femaleId}` : `${femaleId}|${maleId}`
        const rank = Math.min(getBirthRank(maleId), getBirthRank(femaleId))
        const parentsKey = (nodeById.get(maleId)?.parents ?? []).concat(nodeById.get(femaleId)?.parents ?? []).sort().join('|') || `single:${maleId}`
        const weight = parentAverageX([maleId, femaleId])
        if (options?.collapsedCouples && options.collapsedCouples.has(collapsedKey)) {
          // treat collapsed couples as a single block anchored at male position
          blocks.push({ ids: [maleId], rank, parentsKey, weight })
        } else {
          blocks.push({ ids: [maleId, femaleId], rank, parentsKey, weight })
        }
      } else {
        const rank = getBirthRank(id)
        const parentsKey = (nodeById.get(id)?.parents ?? []).sort().join('|') || `single:${id}`
        const weight = parentAverageX([id])
        blocks.push({ ids: [id], rank, parentsKey, weight })
      }
    }

    // Order: groups by parents, ordered by parents' average X, then by birth rank within group
    const groups = new Map<string, Block[]>()
    for (const b of blocks) {
      if (!groups.has(b.parentsKey)) groups.set(b.parentsKey, [])
      groups.get(b.parentsKey)!.push(b)
    }
    const orderedGroups = Array.from(groups.entries()).sort((a, b) => {
      const wa = a[1].reduce((s, bl) => s + bl.weight, 0) / a[1].length
      const wb = b[1].reduce((s, bl) => s + bl.weight, 0) / b[1].length
      return wa - wb
    })

    const orderedBlocks: Block[] = []
    const nameOf = (id: string) => {
      const p = nodeById.get(id)
      return `${p?.last_name ?? ''} ${p?.first_name ?? ''}`.toLowerCase()
    }
    for (const [, blks] of orderedGroups) {
      blks.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank
        const aId = a.ids[0]
        const bId = b.ids[0]
        return nameOf(aId).localeCompare(nameOf(bId))
      })
      orderedBlocks.push(...blks)
    }

    // Assign X positions left->right using variable block widths to avoid overlap
    let xCursor = 0
    for (const blk of orderedBlocks) {
      const blockWidth = blk.ids.length === 2 ? partnerHorizGap + cardWidth : cardWidth
      const center = xCursor + blockWidth / 2
      if (blk.ids.length === 2) {
        const [maleId, femaleId] = blk.ids
        const leftX = center - partnerHorizGap / 2
        const rightX = center + partnerHorizGap / 2
        positionById.set(maleId, { id: maleId, x: leftX, y, depth: g })
        positionById.set(femaleId, { id: femaleId, x: rightX, y, depth: g })
      } else {
        const id = blk.ids[0]
        positionById.set(id, { id, x: center, y, depth: g })
      }
      xCursor += blockWidth + blockMargin
    }

    // Center this generation around 0 for nicer initial view
    const xs = ids.map((id) => positionById.get(id)?.x ?? 0)
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2
    for (const id of ids) {
      const pn = positionById.get(id)!
      pn.x -= mid
    }
  }

  const nodes = Array.from(positionById.values())
  return { nodes, positionById }
}

