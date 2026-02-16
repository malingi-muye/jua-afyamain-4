"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/singleton" // Updated import
import type { Clinic, User } from "@/types/database"

interface ClinicContextType {
  clinic: Clinic | null
  members: User[]
  isLoading: boolean
  refreshClinic: () => Promise<void>
  refreshMembers: () => Promise<void>
  updateClinic: (updates: Partial<Clinic>) => Promise<boolean>
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined)

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshClinic = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setClinic(null)
        return
      }

      // Get user's clinic ID
      const { data: userRecord } = await supabase.from("users").select("clinic_id").eq("id", user.id).single()

      if (!userRecord?.clinic_id) {
        setClinic(null)
        return
      }

      // Fetch clinic
      const { data: clinicData } = await supabase.from("clinics").select("*").eq("id", userRecord.clinic_id).single()

      if (clinicData) {
        setClinic(clinicData as Clinic)
      }
    } catch (error) {
      console.error("[v0] Error fetching clinic:", error)
    }
  }, [])

  const refreshMembers = useCallback(async () => {
    if (!clinic) return

    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from("users").select("*").eq("clinic_id", clinic.id).order("created_at", {
        ascending: false,
      })

      if (data) {
        setMembers(data as User[])
      }
    } catch (error) {
      console.error("[v0] Error fetching members:", error)
    }
  }, [clinic])

  const updateClinic = async (updates: Partial<Clinic>): Promise<boolean> => {
    if (!clinic) return false

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from("clinics")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", clinic.id)

      if (error) throw error

      setClinic((prev) => (prev ? { ...prev, ...updates } : null))
      return true
    } catch (error) {
      console.error("[v0] Error updating clinic:", error)
      return false
    }
  }

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await refreshClinic()
      setIsLoading(false)
    }
    init()
  }, [refreshClinic])

  useEffect(() => {
    if (clinic) {
      refreshMembers()
    }
  }, [clinic, refreshMembers])

  return (
    <ClinicContext.Provider
      value={{
        clinic,
        members,
        isLoading,
        refreshClinic,
        refreshMembers,
        updateClinic,
      }}
    >
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinic() {
  const context = useContext(ClinicContext)
  if (context === undefined) {
    throw new Error("useClinic must be used within a ClinicProvider")
  }
  return context
}
