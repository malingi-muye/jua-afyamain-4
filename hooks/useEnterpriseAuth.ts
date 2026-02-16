"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { AuthChangeEvent, Session } from "@supabase/supabase-js"
import type { User, Organization, UserRole } from "@/types/enterprise"
import type { TeamMember, Role } from "@/types"
import { NEW_ROLE_MAP, LEGACY_ROLE_MAP } from "@/types/enterprise"
import { sessionManager } from "@/lib/sessionManager"
import logger from "@/lib/logger"
import { initAuthManager, subscribeAuth } from "@/lib/authManager"

interface UseEnterpriseAuthReturn {
  user: User | null
  organization: Organization | null
  teamMember: TeamMember | null
  isLoading: boolean
  isAuthenticated: boolean
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ success: boolean; error?: string; session?: Session | null }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  waitForUserSync: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
}

// Global cache to prevent flash of unauthenticated state across navigation
let cachedUser: User | null = null
let cachedOrg: Organization | null = null

// Track in-flight fetch to prevent duplicate parallel requests
let fetchInFlight: Promise<void> | null = null
let lastFetchedUserId: string | null = null

export function useEnterpriseAuth(): UseEnterpriseAuthReturn {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [organization, setOrganization] = useState<Organization | null>(cachedOrg)
  const [isLoading, setIsLoading] = useState(!cachedUser)
  const [error, setError] = useState<string | null>(null)
  const userSyncRef = useRef<(() => void) | null>(null)

  const fetchUserData = useCallback(async (authUserId: string) => {
    // If we're already fetching for this user, return the existing promise
    if (fetchInFlight && lastFetchedUserId === authUserId) {
      logger.log('[useEnterpriseAuth] Fetch already in flight for this user, reusing...')
      return fetchInFlight
    }

    lastFetchedUserId = authUserId
    const startTime = Date.now()
    try {
      logger.log('[useEnterpriseAuth] Fetching user profile + clinic...')

      // Efficient joined query: gets user and clinic in ONE network trip
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select(`
          id, clinic_id, email, full_name, phone, avatar_url, role, department, license_number, specialization, status, last_login_at, last_active_at, preferences, created_at, updated_at,
          clinics (id, name, slug, owner_id, logo_url, email, phone, location, country, currency, timezone, plan, plan_seats, status, trial_ends_at, settings, metadata, created_at, updated_at)
        `)
        .eq("id", authUserId)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile) {
        logger.error("[useEnterpriseAuth] User profile not found in database")
        setError("User profile not found in database.")
        setUser(null)
        setIsLoading(false)
        return
      }

      // Normalize role
      const dbRole = profile.role as string
      let normalizedRole: UserRole = "Admin"

      const roleSearchKey = dbRole.toLowerCase().replace(" ", "_").replace("superadmin", "super_admin")

      if (LEGACY_ROLE_MAP[roleSearchKey]) {
        normalizedRole = LEGACY_ROLE_MAP[roleSearchKey]
      } else if (LEGACY_ROLE_MAP[dbRole]) {
        normalizedRole = LEGACY_ROLE_MAP[dbRole]
      } else {
        // Fallback or identity mapping if it matches a valid UserRole
        normalizedRole = dbRole as UserRole
      }

      const mappedUser: User = {
        id: profile.id,
        clinicId: profile.clinic_id || null,
        email: profile.email || "",
        fullName: profile.full_name || "User",
        phone: profile.phone || null,
        avatarUrl: profile.avatar_url || null,
        role: normalizedRole,
        department: profile.department || null,
        licenseNumber: profile.license_number || null,
        specialization: profile.specialization || null,
        status: profile.status || "active",
        lastLoginAt: profile.last_login_at || null,
        lastActiveAt: profile.last_active_at || null,
        preferences: profile.preferences || {},
        createdAt: profile.created_at || new Date().toISOString(),
        updatedAt: profile.updated_at || new Date().toISOString(),
      }

      let mappedOrg: Organization | null = null
      if (profile.clinics) {
        const clinic = profile.clinics
        mappedOrg = {
          id: clinic.id,
          name: clinic.name,
          slug: clinic.slug || clinic.name.toLowerCase().replace(/\s+/g, '-'),
          ownerId: clinic.owner_id || null,
          logoUrl: clinic.logo_url || null,
          email: clinic.email || null,
          phone: clinic.phone || null,
          address: clinic.location || null,
          country: clinic.country || null,
          currency: clinic.currency || 'KES',
          timezone: clinic.timezone || 'Africa/Nairobi',
          plan: clinic.plan || 'free',
          planSeats: clinic.plan_seats || 1,
          status: clinic.status || 'active',
          trialEndsAt: clinic.trial_ends_at || null,
          settings: clinic.settings || {},
          metadata: clinic.metadata || {},
          createdAt: clinic.created_at,
          updatedAt: clinic.updated_at,
        }
      }

      // Update state and global cache
      cachedUser = mappedUser
      cachedOrg = mappedOrg
      setUser(mappedUser)
      setOrganization(mappedOrg)
      sessionManager.setSession(profile.id, profile.email)

      logger.log(`[useEnterpriseAuth] Profile loaded in ${Date.now() - startTime}ms`)

      // Update last active in background (throttled to once per 5 mins)
      const now = new Date()
      const lastActive = mappedUser.lastActiveAt ? new Date(mappedUser.lastActiveAt) : new Date(0)
      if (now.getTime() - lastActive.getTime() > 5 * 60 * 1000) {
        supabase.from("users").update({ last_active_at: now.toISOString() }).eq("id", authUserId).then(() => { })
      }

    } catch (err: any) {
      logger.error("[useEnterpriseAuth] Error fetching user data:", err.message)
      setError(err.message || "Failed to load user data")
    } finally {
      setIsLoading(false)
      fetchInFlight = null
      if (userSyncRef.current) {
        userSyncRef.current()
        userSyncRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap fetchUserData to track in-flight promise
  const fetchUserDataTracked = useCallback((authUserId: string) => {
    const promise = fetchUserData(authUserId)
    fetchInFlight = promise
    return promise
  }, [])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    fetchInFlight = null // Clear in-flight to force a fresh fetch
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await fetchUserDataTracked(session.user.id)
    } else {
      setUser(null)
      setOrganization(null)
      setIsLoading(false)
    }
  }, [fetchUserDataTracked])

  useEffect(() => {
    // Only initialize once per session
    initAuthManager().catch(e => logger.warn('[useEnterpriseAuth] initAuthManager error:', e))

    const unsubscribe = subscribeAuth(async (event: AuthChangeEvent, session: Session | null) => {
      logger.log('[useEnterpriseAuth] Auth Event:', event)

      if (event === "SIGNED_IN") {
        // On SIGNED_IN, only fetch if we don't already have cached data
        // INITIAL_SESSION fires right after and will handle the fetch if needed
        if (session?.user && !cachedUser) {
          await fetchUserDataTracked(session.user.id)
        } else if (session?.user && cachedUser) {
          // Already have data, just ensure state is set
          setUser(cachedUser)
          setOrganization(cachedOrg)
          setIsLoading(false)
        }
      } else if (event === "TOKEN_REFRESHED") {
        // Token refreshed - re-fetch only if no cached user or different user
        if (session?.user && !cachedUser) {
          await fetchUserDataTracked(session.user.id)
        } else {
          setIsLoading(false)
        }
      } else if (event === "INITIAL_SESSION") {
        // For initial session, only fetch if we have a session AND no cached user
        if (session?.user) {
          if (!cachedUser) {
            await fetchUserDataTracked(session.user.id)
          } else {
            // Use cached user if available
            setUser(cachedUser)
            setOrganization(cachedOrg)
            setIsLoading(false)
          }
        } else {
          // No session, just set loading to false
          setIsLoading(false)
        }
      } else if (event === "SIGNED_OUT") {
        cachedUser = null
        cachedOrg = null
        fetchInFlight = null
        lastFetchedUserId = null
        setUser(null)
        setOrganization(null)
        setIsLoading(false)
        sessionManager.clearSession()
      }
    })

    return () => unsubscribe()
  }, [fetchUserDataTracked])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    try {
      logger.log('[useEnterpriseAuth] Signing up user:', email, 'with metadata:', metadata)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: metadata }
      })

      if (error) {
        logger.error('[useEnterpriseAuth] Signup error:', error)
        // Provide more detailed error message
        const errorMessage = error.message || error.status?.toString() || 'Signup failed'
        return { success: false, error: errorMessage }
      }

      logger.log('[useEnterpriseAuth] Signup successful, user created:', data.user?.id)
      return { success: true, session: data.session }
    } catch (err: any) {
      logger.error('[useEnterpriseAuth] Signup exception:', err)
      return { success: false, error: err.message || 'An unexpected error occurred during signup' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    cachedUser = null
    cachedOrg = null
    setUser(null)
    setOrganization(null)
    sessionManager.clearSession()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  const teamMember: TeamMember | null = user ? {
    id: user.id,
    clinicId: user.clinicId || undefined,
    name: user.fullName,
    email: user.email,
    phone: user.phone || undefined,
    role: NEW_ROLE_MAP[user.role] as Role,
    status: user.status === "active" ? "Active" : user.status === "invited" ? "Invited" : "Deactivated",
    lastActive: user.lastActiveAt || "Unknown",
    avatar: user.avatarUrl || undefined,
    specialization: user.specialization || undefined,
    bio: (user.preferences as any)?.bio || undefined,
    address: (user.preferences as any)?.address || undefined,
    preferences: user.preferences,
  } : null

  const waitForUserSync = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (user && !isLoading) resolve()
      else userSyncRef.current = () => resolve()
    })
  }, [user, isLoading])

  return {
    user, organization, teamMember, isLoading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role?.toLowerCase() === "superadmin" || user?.role?.toLowerCase() === "super_admin",
    isOrgAdmin: ["admin", "superadmin", "super_admin"].includes(user?.role?.toLowerCase() || ""),
    error, signIn, signUp, signOut, refresh, waitForUserSync, resetPassword,
  }
}
