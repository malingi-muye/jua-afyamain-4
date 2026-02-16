/**
 * Data Export Service
 * Handles server-side data exports for large datasets
 */

import { supabase } from "../lib/supabaseClient"
import { enterpriseDb } from "./enterprise-db"

export interface ExportOptions {
  format: "csv" | "json" | "xlsx"
  filters?: Record<string, any>
  dateRange?: { from: string; to: string }
  includeDeleted?: boolean
}

export const exportService = {
  /**
   * Export patients data (server-side for large datasets)
   */
  async exportPatients(options: ExportOptions = { format: "csv" }): Promise<Blob> {
    const clinicId = await enterpriseDb.getOrganization().then(org => org?.id || null)
    if (!clinicId) throw new Error("No clinic found")

    const { data: patientsData, error } = await supabase
      .from("patients")
      .select("mrn, name, phone, email, gender, age, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })

    if (error) throw error

    if (options.format === "csv") {
      return this.convertToCSV(patientsData || [], [
        "mrn",
        "name",
        "phone",
        "email",
        "gender",
        "age",
        "created_at",
      ])
    }

    if (options.format === "json") {
      return new Blob([JSON.stringify(patientsData, null, 2)], { type: "application/json" })
    }

    throw new Error("Unsupported format")
  },

  /**
   * Export appointments data
   */
  async exportAppointments(options: ExportOptions = { format: "csv" }): Promise<Blob> {
    const clinicId = await enterpriseDb.getOrganization().then(org => org?.id || null)
    if (!clinicId) throw new Error("No clinic found")

    const { data, error } = await supabase
      .from("appointments")
      .select("*, patients(name)")
      .eq("clinic_id", clinicId)
      .order("appointment_date", { ascending: false })

    if (error) throw error

    if (options.format === "csv") {
      const flattened = (data || []).map((a: any) => ({
        id: a.id,
        patient_name: a.patients?.name || a.patient_name,
        appointment_date: a.appointment_date,
        status: a.status,
        reason: a.reason,
      }))
      return this.convertToCSV(flattened, ["id", "patient_name", "appointment_date", "status", "reason"])
    }

    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  },

  /**
   * Export visits data
   */
  async exportVisits(options: ExportOptions = { format: "csv" }): Promise<Blob> {
    const clinicId = await enterpriseDb.getOrganization().then(org => org?.id || null)
    if (!clinicId) throw new Error("No clinic found")

    const { data, error } = await supabase
      .from("visits")
      .select("*, patients(name, phone)") // Changed to select 'name' and 'phone'
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })

    if (error) throw error

    if (options.format === "csv") {
      const flattened = (data || []).map((v: any) => ({
        id: v.id,
        patient_name: v.patients?.name || v.patient_name,
        stage: v.stage,
        diagnosis: v.diagnosis,
        total_bill: v.total_bill,
        payment_status: v.payment_status,
        created_at: v.created_at,
      }))
      return this.convertToCSV(flattened, ["id", "patient_name", "stage", "diagnosis", "total_bill", "payment_status", "created_at"])
    }

    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  },

  /**
   * Export audit logs
   */
  async exportAuditLogs(options: ExportOptions = { format: "csv" }): Promise<Blob> {
    const logs = await enterpriseDb.getAuditLogs(10000) // Get up to 10k logs

    if (options.format === "csv") {
      return this.convertToCSV(logs, [
        "createdAt",
        "userName",
        "action",
        "resourceType",
        "resourceId",
        "status",
      ])
    }

    return new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" })
  },

  /**
   * Export MOH report data
   */
  async exportMOHReport(data: any[], formType: string): Promise<Blob> {
    const headers = ["Code", "Disease / Condition", "New Cases", "Re-Visits", "Referrals In"]
    const columns = ["code", "disease", "newCases", "reVisits", "referrals"]

    return this.convertToCSV(data, columns)
  },

  /**
   * Helper: Convert data to CSV
   */
  convertToCSV(data: any[], columns: string[]): Blob {
    const headers = columns.map(c => {
      // Humanize headers if needed or use custom mapping
      if (c === "newCases") return "New Cases"
      if (c === "reVisits") return "Re-Visits"
      if (c === "referrals") return "Referrals In"
      return c.charAt(0).toUpperCase() + c.slice(1)
    }).join(",")

    const rows = data.map((item) =>
      columns
        .map((col) => {
          const value = item[col]
          if (value === null || value === undefined) return ""
          if (typeof value === "object") return JSON.stringify(value)
          return String(value).replace(/"/g, '""')
        })
        .map((v) => `"${v}"`)
        .join(",")
    )

    const csv = [headers, ...rows].join("\n")
    return new Blob([csv], { type: "text/csv;charset=utf-8;" })
  },
}
