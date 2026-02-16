/**
 * Server-side RBAC utilities for JuaAfya
 * Includes permission checking, role validation, and access guards
 */

import { getSupabaseServerClient } from "./multitenancy"
import type { UserRole, User, Clinic } from "@/types/enterprise"
import { isSuperAdmin, hasPermission } from "./rbac"

/**
 * Server-side permission guard
 * Throws error if user doesn't have permission
 */
export async function guardServerAction(
  userId: string,
  permission: string,
  clinicId?: string,
): Promise<{ user: User; clinic: Clinic | null }> {
  const supabase = await getSupabaseServerClient()

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*, clinics(*)")
    .eq("id", userId)
    .single()

  if (userError || !user) {
    throw new Error("User not found")
  }

  // Check if user has permission
  if (!hasPermission(user.role, permission as any)) {
    throw new Error(`Permission denied: ${permission}`)
  }

  if (clinicId && !isSuperAdmin(user.role)) {
    if (user.clinic_id !== clinicId) {
      throw new Error("Unauthorized: No access to this clinic")
    }
  }

  return {
    user,
    clinic: user.clinics || null,
  }
}

/**
 * Verify user is admin of their clinic
 */
export async function requireClinicAdmin(userId: string, clinicId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: user } = await supabase.from("users").select("role, clinic_id").eq("id", userId).maybeSingle()

  if (!user) {
    throw new Error("User not found")
  }

  const normalizedRole = user.role?.toLowerCase().replace(" ", "_")
  if (normalizedRole !== "admin" && normalizedRole !== "superadmin" && normalizedRole !== "super_admin") {
    throw new Error("Only clinic admins can perform this action")
  }

  if (normalizedRole !== "superadmin" && normalizedRole !== "super_admin" && user.clinic_id !== clinicId) {
    throw new Error("Unauthorized: No access to this clinic")
  }

  return user
}

export const requireOrgAdmin = requireClinicAdmin

/**
 * Verify user is super admin
 */
export async function requireSuperAdmin(userId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: user } = await supabase.from("users").select("role").eq("id", userId).maybeSingle()

  const normalizedRole = user?.role?.toLowerCase().replace(" ", "_")
  if (!user || (normalizedRole !== "superadmin" && normalizedRole !== "super_admin")) {
    throw new Error("Only super admins can perform this action")
  }

  return user
}

/**
 * Get available clinics for a user
 */
export async function getUserAccessibleClinics(userId: string) {
  const supabase = await getSupabaseServerClient()

  const { data: user } = await supabase.from("users").select("role, clinic_id").eq("id", userId).maybeSingle()

  if (!user) {
    return []
  }

  const normalizedRole = user.role?.toLowerCase().replace(" ", "_")
  if (normalizedRole === "superadmin" || normalizedRole === "super_admin") {
    const { data: clinics } = await supabase.from("clinics").select("*")
    return clinics || []
  }

  if (user.clinic_id) {
    const { data: clinic } = await supabase.from("clinics").select("*").eq("id", user.clinic_id).single()
    return clinic ? [clinic] : []
  }

  return []
}

/**
 * Get all users in a specific clinic
 * Requires clinic admin access
 */
export async function getClinicUsers(userId: string, clinicId: string) {
  await requireClinicAdmin(userId, clinicId)

  const supabase = await getSupabaseServerClient()

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })

  return users || []
}

export const getTenantUsers = getClinicUsers

/**
 * Remove a user from a clinic
 */
export async function removeClinicUser(requestingUserId: string, clinicId: string, targetUserId: string) {
  await requireClinicAdmin(requestingUserId, clinicId)

  // Prevent self-removal
  if (requestingUserId === targetUserId) {
    throw new Error("Cannot remove yourself from clinic")
  }

  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from("users")
    .update({ clinic_id: null, status: "deactivated" })
    .eq("id", targetUserId)
    .eq("clinic_id", clinicId)

  if (error) {
    throw error
  }
}

/**
 * Update user role in clinic
 */
export async function updateUserRole(
  requestingUserId: string,
  clinicId: string,
  targetUserId: string,
  newRole: UserRole,
) {
  const requester = await requireClinicAdmin(requestingUserId, clinicId)

  // Super admin cannot be downgraded by regular admin
  const supabase = await getSupabaseServerClient()
  const { data: target } = await supabase.from("users").select("role").eq("id", targetUserId).maybeSingle()

  const normalizedTargetRole = target?.role?.toLowerCase().replace(" ", "_")
  const normalizedRequesterRole = requester.role?.toLowerCase().replace(" ", "_")
  if ((normalizedTargetRole === "superadmin" || normalizedTargetRole === "super_admin") &&
    (normalizedRequesterRole !== "superadmin" && normalizedRequesterRole !== "super_admin")) {
    throw new Error("Cannot modify super admin role")
  }

  const { error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", targetUserId)
    .eq("clinic_id", clinicId)

  if (error) {
    throw error
  }
}

/**
 * Create a new clinic
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
  const supabase = await getSupabaseServerClient()

  // Verify user is super_admin
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).maybeSingle()

  const normalizedRole = user?.role?.toLowerCase().replace(" ", "_")
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
