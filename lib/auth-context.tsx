"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { getSupabase } from "./supabaseClient"
import logger from "./logger"
import type { User as SupabaseUser, AuthChangeEvent, Session } from "@supabase/supabase-js"
import type { User, Organization, AuthSession, UserRole } from "@/types/enterprise"
import { NEW_ROLE_MAP } from "@/types/enterprise"

interface AuthContextType extends AuthSession {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser) => {
    try {
      const supabase = getSupabase()
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()

      if (profileError) {
        logger.warn("User profile not found:", profileError)

        const basicUser: User = {
          id: authUser.id,
          email: authUser.email || "",
          fullName: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
          role: (authUser.user_metadata?.role as UserRole) || "doctor",
          status: "active",
          preferences: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setUser(basicUser)
        return
      }

      const mappedUser: User = {
        id: profile.id,
        clinicId: profile.clinic_id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        avatarUrl: profile.avatar_url,
        role: profile.role as UserRole,
        department: profile.department,
        licenseNumber: profile.license_number,
        specialization: profile.specialization,
        status: profile.status,
        lastLoginAt: profile.last_login_at,
        lastActiveAt: profile.last_active_at,
        preferences: profile.preferences || {},
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      }

      setUser(mappedUser)

      if (profile.clinic_id) {
        const { data: clinic, error: clinicError } = await supabase
          .from("clinics")
          .select("*")
          .eq("id", profile.clinic_id)
          .single()

        if (!clinicError && clinic) {
          const mappedClinic: Organization = {
            id: clinic.id,
            name: clinic.name,
            slug: clinic.slug,
            ownerId: clinic.owner_id,
            logoUrl: clinic.logo_url,
            email: clinic.email,
            phone: clinic.phone,
            address: clinic.address,
            country: clinic.country,
            currency: clinic.currency,
            timezone: clinic.timezone,
            plan: clinic.plan,
            planSeats: clinic.plan_seats,
            status: clinic.status,
            trialEndsAt: clinic.trial_ends_at,
            settings: clinic.settings || {},
            metadata: clinic.metadata || {},
            createdAt: clinic.created_at,
            updatedAt: clinic.updated_at,
          }
          setOrganization(mappedClinic)
        }
      }

      await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", authUser.id)
    } catch (error) {
      console.error("Error fetching user profile:", error)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = getSupabase()

      // Wrap entire session retrieval in try-catch to handle refresh token errors
      let session = null
      try {
        const {
          data: { session: retrievedSession },
          error,
        } = await supabase.auth.getSession()

        // Handle refresh token errors gracefully
        if (error) {
          if (error.message?.includes("Refresh Token") || error.message?.includes("Invalid") || error.message?.includes("Not Found")) {
            console.debug("[Auth Context] Refresh token error detected:", error.message)
            throw error
          }
          throw error
        }

        session = retrievedSession
      } catch (sessionError) {
        const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError)
        if (errorMessage?.includes("Refresh Token") || errorMessage?.includes("Invalid") || errorMessage?.includes("Not Found")) {
          console.debug("[Auth Context] Refresh token not found, clearing session")
          // Clear the corrupted session
          try {
            const supabase = getSupabase()
            await supabase.auth.signOut({ scope: 'local' })
          } catch (signOutError) {
            console.debug("[Auth Context] Error during sign out")
          }
          setUser(null)
          setOrganization(null)
          return
        }
        // Re-throw other errors
        throw sessionError
      }

      if (session?.user) {
        await fetchUserProfile(session.user)
      } else {
        setUser(null)
        setOrganization(null)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Only log if it's not a refresh token error (already handled above)
      if (!errorMessage?.includes("Refresh Token") && !errorMessage?.includes("Invalid") && !errorMessage?.includes("Not Found")) {
        console.error("Error refreshing session:", error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [fetchUserProfile])

  useEffect(() => {
    refreshSession()

    const supabase = getSupabase()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      try {
        if (event === "SIGNED_IN" && session?.user) {
          await fetchUserProfile(session.user)
        } else if (event === "SIGNED_OUT") {
          setUser(null)
          setOrganization(null)
        }
        // Handle initial session errors
        else if (event === "INITIAL_SESSION" && !session) {
          setUser(null)
          setOrganization(null)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage?.includes("Refresh Token") || errorMessage?.includes("Invalid") || errorMessage?.includes("Not Found")) {
          console.debug("[Auth Context] Auth state change error related to refresh token, clearing auth")
          try {
            await supabase.auth.signOut({ scope: 'local' })
          } catch (signOutError) {
            console.debug("[Auth Context] Error signing out during auth state change")
          }
          setUser(null)
          setOrganization(null)
        } else {
          console.error("Error in auth state change:", error)
        }
      } finally {
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserProfile, refreshSession])

  const signIn = async (email: string, password: string) => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error

      // Verify session was created
      if (data?.session?.user) {
        await fetchUserProfile(data.session.user)
      }

      return { error: null }
    } catch (error) {
      const err = error as Error
      if (err.message?.includes("Refresh Token") || err.message?.includes("Invalid")) {
        console.debug("[Auth Context] Refresh token error during sign in")
        return { error: new Error("Session error. Please try logging in again.") }
      }
      return { error: err }
    }
  }

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: metadata,
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    setUser(null)
    setOrganization(null)
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return { error: new Error("Not authenticated") }

    try {
      const supabase = getSupabase()
      const dbUpdates: Record<string, any> = {}
      if (updates.fullName) dbUpdates.full_name = updates.fullName
      if (updates.phone) dbUpdates.phone = updates.phone
      if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl
      if (updates.department) dbUpdates.department = updates.department
      if (updates.licenseNumber) dbUpdates.license_number = updates.licenseNumber
      if (updates.specialization) dbUpdates.specialization = updates.specialization
      if (updates.preferences) dbUpdates.preferences = updates.preferences
      dbUpdates.updated_at = new Date().toISOString()

      const { error } = await supabase.from("users").update(dbUpdates).eq("id", user.id)

      if (error) throw error

      setUser((prev) => (prev ? { ...prev, ...updates } : null))
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const value: AuthContextType = {
    user,
    organization,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role?.toLowerCase() === "superadmin" || user?.role?.toLowerCase() === "super_admin",
    isOrgAdmin: ["admin", "superadmin", "super_admin"].includes(user?.role?.toLowerCase() || ""),
    signIn,
    signUp,
    signOut,
    refreshSession,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function usePermission(module: string, action = "view"): boolean {
  const { user } = useAuth()

  if (!user) return false
  const normalizedRole = user.role?.toLowerCase().replace(" ", "_")
  if (normalizedRole === "superadmin" || normalizedRole === "super_admin") return true

  const permissions: Record<string, Record<string, string[]>> = {
    admin: {
      "*": ["view", "create", "edit", "delete", "export", "manage"],
    },
    doctor: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      appointments: ["view", "create", "edit"],
      visits: ["view", "create", "edit"],
      inventory: ["view"],
      pharmacy: ["view", "dispense"],
      reports: ["view"],
    },
    nurse: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      appointments: ["view"],
      visits: ["view", "create", "edit"],
      inventory: ["view"],
    },
    receptionist: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      appointments: ["view", "create", "edit", "delete"],
      visits: ["view", "create"],
      billing: ["view"],
      sms: ["send"],
    },
    pharmacist: {
      dashboard: ["view"],
      patients: ["view"],
      visits: ["view"],
      inventory: ["view", "create", "edit", "delete"],
      pharmacy: ["view", "dispense"],
      reports: ["view"],
    },
    lab_tech: {
      dashboard: ["view"],
      patients: ["view"],
      visits: ["view", "edit"],
      inventory: ["view"],
      reports: ["view"],
    },
    accountant: {
      dashboard: ["view", "export"],
      patients: ["view"],
      appointments: ["view"],
      visits: ["view"],
      inventory: ["view"],
      reports: ["view", "export"],
      billing: ["view", "manage"],
      audit: ["view"],
    },
  }

  const rolePerms = permissions[normalizedRole]
  if (!rolePerms) return false

  if (rolePerms["*"]?.includes(action)) return true

  return rolePerms[module]?.includes(action) ?? false
}

export function getLegacyRole(role: UserRole): string {
  return NEW_ROLE_MAP[role] || "Doctor"
}
