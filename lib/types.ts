export type Gender = 'M' | 'F' | null
export type LifeStatus = 'Living' | 'Deceased' | null

export interface Person {
  id: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  gender: Gender
  generation?: number | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  death_place: string | null
  status: LifeStatus
  phone: string | null
  facebook: string | null
  photo: string | null
}

export interface Marriage {
  id: string
  partner_a: string
  partner_b: string
}

export interface ParentChild {
  id: string
  parent_id: string
  child_id: string
}

export interface TreeNode extends Person {
  children: string[]
  partners: string[]
  parents?: string[]
}

