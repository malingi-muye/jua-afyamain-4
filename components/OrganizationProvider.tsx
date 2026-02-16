"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Organization, User } from "@/types/enterprise"

interface OrganizationContextType {
  organization: Organization | null
  members: User[]
  isLoading: boolean
  refreshOrganization: () => Promise<void>
  refreshMembers: () => Promise<void>
  updateOrganization: (updates: Partial<Organization>) => Promise<boolean>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshOrganization = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setOrganization(null)
        return
      }

      // Get user's organization ID
      const { data: profile } = await supabase.from("users").select("organization_id").eq("id", user.id).single()

      if (!profile?.organization_id) {
        setOrganization(null)
        return
      }

      // Fetch organization
      const { data: org } = await supabase.from("organizations").select("*").eq("id", profile.organization_id).single()

      if (org) {
        setOrganization({
          id: org.id,
          name: org.name,
          slug: org.slug,
          ownerId: org.owner_id,
          logoUrl: org.logo_url,
          email: org.email,
          phone: org.phone,
          address: org.address,
          country: org.country,
          currency: org.currency,
          timezone: org.timezone,
          plan: org.plan,
          planSeats: org.plan_seats,
          status: org.status,
          trialEndsAt: org.trial_ends_at,
          settings: org.settings || {},
          metadata: org.metadata || {},
          createdAt: org.created_at,
          updatedAt: org.updated_at,
        })
      }
    } catch (error) {
      console.error("Error fetching organization:", error)
    }
  }, [])

  const refreshMembers = useCallback(async () => {
    if (!organization) return

    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("clinic_id", organization.id)
        .order("created_at", { ascending: false })

      if (data) {
        setMembers(
          data.map((u: any) => ({
            id: u.id,
            clinicId: u.clinic_id,
            email: u.email,
            fullName: u.full_name,
            phone: u.phone,
            avatarUrl: u.avatar_url,
            role: u.role,
            department: u.department,
            licenseNumber: u.license_number,
            specialization: u.specialization,
            status: u.status,
            lastLoginAt: u.last_login_at,
            lastActiveAt: u.last_active_at,
            preferences: u.preferences || {},
            createdAt: u.created_at,
            updatedAt: u.updated_at,
          })),
        )
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    }
  }, [organization])

  const updateOrganization = async (updates: Partial<Organization>): Promise<boolean> => {
    if (!organization) return false

    try {
      const dbUpdates: Record<string, any> = {}
      if (updates.name) dbUpdates.name = updates.name
      if (updates.email) dbUpdates.email = updates.email
      if (updates.phone) dbUpdates.phone = updates.phone
      if (updates.address) dbUpdates.address = updates.address
      if (updates.logoUrl) dbUpdates.logo_url = updates.logoUrl
      if (updates.settings) dbUpdates.settings = updates.settings
      dbUpdates.updated_at = new Date().toISOString()

      const { error } = await supabase.from("organizations").update(dbUpdates).eq("id", organization.id)

      if (error) throw error

      setOrganization((prev) => (prev ? { ...prev, ...updates } : null))
      return true
    } catch (error) {
      console.error("Error updating organization:", error)
      return false
    }
  }

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await refreshOrganization()
      setIsLoading(false)
    }
    init()
  }, [refreshOrganization])

  useEffect(() => {
    if (organization) {
      refreshMembers()
    }
  }, [organization, refreshMembers])

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        members,
        isLoading,
        refreshOrganization,
        refreshMembers,
        updateOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider")
  }
  return context
}
