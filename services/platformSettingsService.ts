/**
 * Platform Settings Service
 * Manages global platform configuration for super admin
 */

import { supabase } from "../lib/supabaseClient"

export interface PlatformSettings {
  maintenanceMode: boolean
  allowNewRegistrations: boolean
  globalAnnouncement: string
  pricing: {
    free: number
    pro: number
    enterprise: number
  }
}

const PLATFORM_SETTINGS_KEY = "platform_settings"

export const platformSettingsService = {
  /**
   * Get platform settings from database
   */
  async getSettings(): Promise<PlatformSettings | null> {
    try {
      // Use a single-row table or JSONB column in a settings table
      // For now, we'll use a simple approach with a platform_settings table
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .single()

      if (error) {
        // Table might not exist - return defaults
        return {
          maintenanceMode: false,
          allowNewRegistrations: true,
          globalAnnouncement: "",
          pricing: { free: 0, pro: 5000, enterprise: 15000 },
        }
      }

      return data.settings as PlatformSettings
    } catch (error) {
      console.error("Error fetching platform settings:", error)
      return {
        maintenanceMode: false,
        allowNewRegistrations: true,
        globalAnnouncement: "",
        pricing: { free: 0, pro: 5000, enterprise: 15000 },
      }
    }
  },

  /**
   * Update platform settings
   */
  async updateSettings(settings: Partial<PlatformSettings>): Promise<boolean> {
    try {
      // Upsert platform settings
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          {
            id: 1,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )

      if (error) throw error
      return true
    } catch (error) {
      console.error("Error updating platform settings:", error)
      return false
    }
  },
}
