/**
 * Multitenancy utilities for JuaAfya (Vite/React Client Version)
 * Handles clinic isolation, context management, and clinic-aware queries
 * 
 * NOTE: This has been refactored for Vite/React and uses the standard supabase client.
 */

import { supabase } from "./supabaseClient"
import type { Clinic, User } from "@/types/enterprise"

/**
 * Get Supabase client (Client-side singleton)
 */
export async function getSupabaseServerClient() {
  return supabase
}

/**
 * Get current clinic (tenant) context
 */
export async function getCurrentClinic(): Promise<Clinic | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return null
  }

  const { data: user } = await supabase.from("users").select("clinic_id").eq("id", session.user.id).maybeSingle()

  if (!user?.clinic_id) {
    return null
  }

  const { data: clinic } = await supabase.from("clinics").select("*").eq("id", user.clinic_id).maybeSingle()

  return clinic
}

/**
 * Get current user with clinic context
 */
export async function getCurrentUserWithClinic(): Promise<{ user: User | null; clinic: Clinic | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { user: null, clinic: null }
  }

  const { data: userProfile } = await supabase.from("users").select("*, clinics(*)").eq("id", session.user.id).maybeSingle()

  if (!userProfile) {
    return { user: null, clinic: null }
  }

  return {
    user: userProfile,
    clinic: userProfile.clinics || null,
  }
}

/**
 * Add clinic filter to Supabase query
 * This ensures RLS policies are respected
 */
export function addClinicFilter(query: any, clinicId: string) {
  return query.eq("clinic_id", clinicId)
}

/**
 * Middleware-like helper to ensure clinic context is set
 */
export async function ensureClinicContext() {
  const { user, clinic } = await getCurrentUserWithClinic()

  if (!user) {
    throw new Error("Unauthorized: No user session")
  }

  const normalizedRole = user.role?.toLowerCase().replace(" ", "_")
  if (!clinic && normalizedRole !== "superadmin" && normalizedRole !== "super_admin") {
    throw new Error("Unauthorized: No clinic context")
  }

  return { user, clinic }
}

/**
 * Check if user has access to a specific clinic
 */
export async function hasAccessToClinic(clinicId: string, userId: string): Promise<boolean> {
  const { data: user } = await supabase.from("users").select("role, clinic_id").eq("id", userId).maybeSingle()

  if (!user) {
    return false
  }

  // Super admin can access any clinic
  const normalizedRole = user.role?.toString().toLowerCase().replace(" ", "_")
  if (normalizedRole === "superadmin" || normalizedRole === "super_admin") {
    return true
  }

  // Regular users can only access their own clinic
  return user.clinic_id === clinicId
}

/**
 * Get list of clinics a user has access to
 */
export async function getUserClinics(userId: string) {
  const { data: user } = await supabase.from("users").select("role, clinic_id").eq("id", userId).maybeSingle()

  if (!user) {
    return []
  }

  // Super admin can see all clinics
  const normalizedRole = user.role?.toString().toLowerCase().replace(" ", "_")
  if (normalizedRole === "superadmin" || normalizedRole === "super_admin") {
    const { data: clinics } = await supabase.from("clinics").select("*")
    return clinics || []
  }

  // Regular users can only see their own clinic
  if (user.clinic_id) {
    const { data: clinic } = await supabase.from("clinics").select("*").eq("id", user.clinic_id).single()
    return clinic ? [clinic] : []
  }

  return []
}

/**
 * Create a new clinic (tenant)
 * Only super_admin can do this
 */
export async function createClinic(
  data: {
    name: string
    email?: string
    phone?: string
    location?: string
    country: string
    currency: string
    timezone: string
    ownerEmail: string
  },
  userId: string,
) {
  // Verify user is super_admin
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).maybeSingle()

  const normalizedRole = user?.role?.toString().toLowerCase().replace(" ", "_")
  if (normalizedRole !== "superadmin" && normalizedRole !== "super_admin") {
    throw new Error("Only super admins can create clinics")
  }

  // Create clinic
  const slug = data.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .insert({
      name: data.name,
      slug,
      email: data.email,
      phone: data.phone,
      location: data.location,
      country: data.country,
      currency: data.currency,
      timezone: data.timezone,
      plan: "free",
      plan_seats: 5,
      status: "active",
    })
    .select()
    .single()

  if (clinicError) {
    throw clinicError
  }

  return clinic
}

/**
 * Helper to create row-level security policy for clinic isolation
 * Used in database setup
 */
export const RLS_POLICY_TEMPLATES = {
  clinicIsolation: (tableName: string) => `
    -- Clinic Isolation Policy for ${tableName}
    -- Users can only see data from their clinic
    CREATE POLICY "Clinic isolation - SELECT" ON ${tableName}
      FOR SELECT
      USING (
        clinic_id = (
          SELECT clinic_id FROM users WHERE id = auth.uid()
        )
        OR
        -- Super admins can see all
        (SELECT role FROM users WHERE id = auth.uid()) = 'SuperAdmin'
      );

    -- Users can only insert data for their clinic
    CREATE POLICY "Clinic isolation - INSERT" ON ${tableName}
      FOR INSERT
      WITH CHECK (
        clinic_id = (
          SELECT clinic_id FROM users WHERE id = auth.uid()
        )
      );

    -- Users can only update data from their clinic
    CREATE POLICY "Clinic isolation - UPDATE" ON ${tableName}
      FOR UPDATE
      USING (
        clinic_id = (
          SELECT clinic_id FROM users WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        clinic_id = (
          SELECT clinic_id FROM users WHERE id = auth.uid()
        )
      );

    -- Users can only delete data from their clinic
    CREATE POLICY "Clinic isolation - DELETE" ON ${tableName}
      FOR DELETE
      USING (
        clinic_id = (
          SELECT clinic_id FROM users WHERE id = auth.uid()
        )
      );
  `,
}
