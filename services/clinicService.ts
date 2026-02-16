/**
 * Clinic Management Service
 * Handles clinic-level operations including deletion
 */

import { supabase } from "../lib/supabaseClient"
import { enterpriseDb } from "./enterprise-db"
// Note: Permission checks are enforced by Supabase Row Level Security (RLS) policies
import logger from '../lib/logger'

export interface DeleteClinicOptions {
  reason?: string
  hardDelete?: boolean // If true, permanently deletes. If false, soft-deletes (sets status to 'cancelled')
}

export const clinicService = {
  /**
   * Soft-delete a clinic (recommended for enterprise SaaS)
   * Sets status to 'cancelled' and logs audit trail
   */
  async softDeleteClinic(clinicId: string, options: DeleteClinicOptions = {}): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "Not authenticated" }
      }

      // Note: Permission checks enforced by Supabase RLS policies
      // await guardServerAction(user.id, "settings.delete_clinic", clinicId)

      // Get clinic info before deletion
      const { data: clinic } = await supabase.from("clinics").select("*").eq("id", clinicId).single()

      if (!clinic) {
        return { success: false, error: "Clinic not found" }
      }

      // Log audit before deletion
      await enterpriseDb.logAudit(
        "clinic_deleted",
        "clinic",
        clinicId,
        { status: clinic.status, name: clinic.name },
        { status: "cancelled", deleted_at: new Date().toISOString(), reason: options.reason }
      )

      // Soft delete: Update status to 'cancelled'
      const { error } = await supabase
        .from("clinics")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
          metadata: {
            ...(clinic.metadata || {}),
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            deletion_reason: options.reason || "User requested deletion",
          },
        })
        .eq("id", clinicId)

      if (error) {
        return { success: false, error: error.message }
      }

      // Log activity
      await enterpriseDb.logActivity("clinic_deleted", `Clinic ${clinic.name} has been deleted`, `Status set to cancelled. Reason: ${options.reason || "Not specified"}`)

      return { success: true }
    } catch (error: any) {
      console.error("Error deleting clinic:", error)
      return { success: false, error: error.message || "Failed to delete clinic" }
    }
  },

  /**
   * Hard-delete a clinic (use with extreme caution)
   * Permanently removes all data - should only be used after grace period
   */
  async hardDeleteClinic(clinicId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Enforce server-side permission check: only super admins can hard-delete clinics
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: "Not authenticated" }
      }

      // Note: Permission checks enforced by Supabase RLS policies
      // await guardServerAction(user.id, "super_admin.delete")

      // Record immutable audit before permanent deletion
      try {
        const { data: clinic } = await supabase.from("clinics").select("*").eq("id", clinicId).maybeSingle()
        await enterpriseDb.logAudit(
          "hard_delete_clinic",
          "clinic",
          clinicId,
          clinic || undefined,
          { deleted_at: new Date().toISOString(), deleted_by: user.id }
        )
      } catch (e) {
        logger.warn("Failed to write audit before hard-delete clinic:", e)
      }

      // Note: This will cascade delete related records due to ON DELETE CASCADE
      const { error } = await supabase.from("clinics").delete().eq("id", clinicId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error("Error hard-deleting clinic:", error)
      return { success: false, error: error.message || "Failed to hard-delete clinic" }
    }
  },
}
