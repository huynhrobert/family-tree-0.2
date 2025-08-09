"use client"
import { createContext, useContext, useState, ReactNode } from 'react'

type EditModeContextValue = { editMode: boolean; setEditMode: (v: boolean) => void }

const EditModeContext = createContext<EditModeContextValue | undefined>(undefined)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)
  return (
    <EditModeContext.Provider value={{ editMode, setEditMode }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext)
  if (!ctx) throw new Error('useEditMode must be used within EditModeProvider')
  return ctx
}


