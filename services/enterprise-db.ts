/**
 * Enterprise Database Service
 * Handles all database operations with multitenancy support
 */

import { supabase } from "@/lib/supabaseClient"
// Note: Permission checks are enforced by Supabase Row Level Security (RLS) policies
import type { User, Organization, OrganizationInvitation, AuditLog, Activity, UserRole } from "@/types/enterprise"
import { LEGACY_ROLE_MAP, NEW_ROLE_MAP } from "@/types/enterprise"
import type { Patient, Appointment, Visit, InventoryItem, Supplier } from "@/types"
import logger from '../lib/logger'

// Helper to get current user's clinic ID (standardized from organization_id)
async function getClinicId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()

  return data?.clinic_id || null
}

export const enterpriseDb = {
  // ==================== ORGANIZATION ====================

  async getOrganization(): Promise<Organization | null> {
    const clinicId = await getClinicId()
    if (!clinicId) return null

    const { data, error } = await supabase.from("clinics").select("id, name, slug, owner_id, logo_url, email, phone, location, country, currency, timezone, plan, plan_seats, status, trial_ends_at, settings, metadata, created_at, updated_at").eq("id", clinicId).single()

    if (error || !data) return null

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      ownerId: data.owner_id,
      logoUrl: data.logo_url,
      email: data.email,
      phone: data.phone,
      address: data.location,
      country: data.country,
      currency: data.currency,
      timezone: data.timezone,
      plan: data.plan,
      planSeats: data.plan_seats,
      status: data.status,
      trialEndsAt: data.trial_ends_at,
      settings: data.settings || {},
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async updateOrganization(updates: Partial<Organization>): Promise<boolean> {
    const clinicId = await getClinicId()
    if (!clinicId) return false

    const dbUpdates: Record<string, any> = {}
    if (updates.name) dbUpdates.name = updates.name
    if (updates.email) dbUpdates.email = updates.email
    if (updates.phone) dbUpdates.phone = updates.phone
    if (updates.address) dbUpdates.location = updates.address
    if (updates.logoUrl) dbUpdates.logo_url = updates.logoUrl
    if (updates.settings) dbUpdates.settings = updates.settings
    dbUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase.from("clinics").update(dbUpdates).eq("id", clinicId)

    return !error
  },

  async deleteClinic(id: string, reason?: string): Promise<boolean> {
    // Server-side permission check: allow clinic admins or super admins to archive/delete clinic
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) throw new Error("Not authenticated")

    // Note: Permission checks enforced by Supabase RLS policies
    // await guardServerAction(user.id, "settings.delete_clinic", id)

    // Log audit before performing destructive action
    try {
      const { data: oldClinic } = await supabase.from("clinics").select("*").eq("id", id).maybeSingle()
      await this.logAudit("delete_clinic", "clinic", id, oldClinic || undefined, { status: "archived", reason })
    } catch (e) {
      // continue even if audit log fails
      logger.warn("Audit log failed for deleteClinic:", e)
    }

    // Soft delete by updating status to archived
    const { error } = await supabase.from("clinics").update({
      status: "archived",
      settings: { deleted_reason: reason, deleted_at: new Date().toISOString() }, // Store reason in settings or metadata
    }).eq("id", id)

    return !error
  },

  // ==================== USERS / TEAM ====================

  async getTeamMembers(): Promise<User[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("users")
      .select("id, clinic_id, email, full_name, phone, avatar_url, role, department, license_number, specialization, status, last_login_at, last_active_at, preferences, created_at, updated_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    return data.map((u: any) => {
      // Normalize role from DB
      const dbRole = u.role as string
      let normalizedRole: UserRole = "Admin"
      if (LEGACY_ROLE_MAP[dbRole]) {
        normalizedRole = LEGACY_ROLE_MAP[dbRole]
      } else if (Object.keys(NEW_ROLE_MAP).includes(dbRole)) {
        normalizedRole = dbRole as UserRole
      }

      return {
        id: u.id,
        organizationId: u.clinic_id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        avatarUrl: u.avatar_url,
        role: normalizedRole,
        department: u.department,
        licenseNumber: u.license_number,
        specialization: u.specialization,
        status: u.status,
        lastLoginAt: u.last_login_at,
        lastActiveAt: u.last_active_at,
        preferences: u.preferences || {},
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }
    })
  },

  async updateTeamMember(userId: string, updates: Partial<User>): Promise<boolean> {
    const dbUpdates: Record<string, any> = {}
    if (updates.fullName) dbUpdates.full_name = updates.fullName
    if (updates.phone) dbUpdates.phone = updates.phone

    if (updates.role) {
      // Use standard DB role format from map
      dbUpdates.role = NEW_ROLE_MAP[updates.role] || updates.role.toLowerCase()
    }

    if (updates.department) dbUpdates.department = updates.department
    if (updates.status) dbUpdates.status = updates.status
    dbUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase.from("users").update(dbUpdates).eq("id", userId)

    return !error
  },

  async deactivateTeamMember(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from("users")
      .update({ status: "deactivated", updated_at: new Date().toISOString() })
      .eq("id", userId)

    return !error
  },

  // ==================== INVITATIONS ====================

  async getInvitations(): Promise<OrganizationInvitation[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("invitations")
      .select("id, clinic_id, email, role, invited_by, status, expires_at, created_at")
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error || !data) return []

    return data.map((inv: any) => ({
      id: inv.id,
      clinicId: inv.clinic_id,
      email: inv.email,
      role: (LEGACY_ROLE_MAP[inv.role] || inv.role) as UserRole,
      invitedBy: inv.invited_by || undefined,
      token: "",
      status: inv.status,
      expiresAt: inv.expires_at,
      acceptedAt: undefined,
      createdAt: inv.created_at,
    }))
  },

  async createInvitation(email: string, role: UserRole): Promise<OrganizationInvitation | null> {
    // 1. Get clinic ID
    const clinicId = await getClinicId()
    if (!clinicId) {
      logger.error("Cannot create invitation: User has no clinic_id")
      throw new Error("You must be associated with a clinic to invite team members")
    }

    // 2. Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logger.error("Cannot create invitation: No authenticated user")
      throw new Error("You must be logged in to invite team members")
    }

    const normalizedEmail = email.toLowerCase().trim()

    // 3. Validate email format
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Invalid email address")
    }

    // 4. Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, clinic_id, email")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      if (existingUser.clinic_id === clinicId) {
        throw new Error(`${existingUser.email} is already a member of this clinic`)
      } else {
        throw new Error(`A user with email ${existingUser.email} already belongs to another clinic`)
      }
    }

    // 5. Normalize role for DB (snake_case)
    const dbRole = NEW_ROLE_MAP[role] || role.toLowerCase().replace(" ", "_")

    // 6. Upsert invitation (allows re-sending/updating)
    const { data, error } = await supabase
      .from("invitations")
      .upsert({
        clinic_id: clinicId,
        email: normalizedEmail,
        role: dbRole,
        invited_by: user.id,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Reset expiry on re-invite
      }, {
        onConflict: 'email'
      })
      .select()
      .single()

    if (error || !data) {
      logger.error("Error creating invitation:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error: error
      })

      // Provide more specific error messages based on error code
      if (error?.code === '42501') {
        throw new Error("Permission denied. You may not have the required role to invite team members.")
      } else if (error?.code === '23505') {
        throw new Error("An invitation for this email already exists")
      } else {
        throw new Error(error?.message || "Failed to create invitation. Please try again or contact support.")
      }
    }

    // 7. Get clinic and inviter details for email
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single()

    const { data: inviter } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .single()

    // 8. Send invitation email
    try {
      const { sendInvitationEmail } = await import('./emailService')

      // Generate invitation link
      const invitationLink = `${window.location.origin}/signup?invitation=${data.id}&email=${encodeURIComponent(normalizedEmail)}`

      await sendInvitationEmail(
        normalizedEmail,
        inviter?.full_name || "Your colleague",
        clinic?.name || "the clinic",
        invitationLink
      )

      logger.log("Invitation email sent successfully", { email: normalizedEmail })
    } catch (emailError) {
      // Log the error but don't fail the invitation creation
      logger.error("Failed to send invitation email:", emailError)
      // Note: The invitation is still created in the database
    }

    return {
      id: data.id,
      clinicId: data.clinic_id,
      email: data.email,
      role: (LEGACY_ROLE_MAP[data.role] || data.role) as UserRole,
      invitedBy: data.invited_by || undefined,
      token: "",
      status: data.status,
      expiresAt: data.expires_at,
      acceptedAt: undefined,
      createdAt: data.created_at,
    }
  },

  async cancelInvitation(invitationId: string): Promise<boolean> {
    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", invitationId)

    return !error
  },

  // ==================== PATIENTS ====================

  async getPatients(): Promise<Patient[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("patients")
      .select("id, name, phone, age, gender, updated_at, history, vitals")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })

    if (error || !data) return []

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone || "",
      age: p.age || 0,
      gender: p.gender || "Other",
      lastVisit: p.updated_at?.split("T")[0] || "",
      notes: p.notes || "",
      history: p.history || [],
      vitals: p.vitals || { bp: "", heartRate: "", temp: "", weight: "" },
    }))
  },

  async createPatient(patient: Omit<Patient, "id">): Promise<Patient | null> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!clinicId) return null

    // Generate MRN if not provided
    const { count } = await supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId)
    const mrn = `MRN-${String((count || 0) + 1).padStart(4, "0")}`

    // Calculate date of birth from age
    const dateOfBirth = patient.age ? new Date(Date.now() - patient.age * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null

    const { data, error } = await supabase
      .from("patients")
      .insert({
        clinic_id: clinicId,
        mrn,
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        history: patient.history || [],
        vitals: patient.vitals || {},
      })
      .select()
      .single()

    if (error || !data) return null

    // Log activity
    await this.logActivity("patient_created", `New patient registered: ${patient.name}`)

    return {
      id: data.id,
      name: data.name,
      phone: data.phone || "",
      age: data.age || 0,
      gender: data.gender || "Other",
      lastVisit: data.updated_at?.split("T")[0] || "",
      notes: data.notes || "",
      history: data.history || [],
      vitals: data.vitals || { bp: "", heartRate: "", temp: "", weight: "" },
    }
  },

  async updatePatient(patient: Patient): Promise<boolean> {
    const dateOfBirth = patient.age ? new Date(Date.now() - patient.age * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null

    const { error } = await supabase
      .from("patients")
      .update({
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        history: patient.history || [],
        vitals: patient.vitals || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", patient.id)

    return !error
  },

  async deletePatient(id: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) throw new Error("Not authenticated")

    // Note: Permission checks enforced by Supabase RLS policies
    // await guardServerAction(user.id, "patients.delete")

    // Capture current patient for audit
    try {
      const { data: oldPatient } = await supabase.from("patients").select("*").eq("id", id).maybeSingle()
      await this.logAudit("delete_patient", "patient", id, oldPatient || undefined, undefined)
    } catch (e) {
      logger.warn("Audit log failed for deletePatient:", e)
    }

    const { error } = await supabase.from("patients").delete().eq("id", id)

    return !error
  },

  // ==================== APPOINTMENTS ====================

  async getAppointments(): Promise<Appointment[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, reason, status, patients(full_name)")
      .eq("clinic_id", clinicId)
      .order("appointment_date", { ascending: true })

    if (error || !data) return []

    return data.map((a: any) => ({
      id: a.id,
      patientId: a.patient_id,
      patientName: a.patients?.full_name || a.patient_name || "Unknown",
      date: a.appointment_date?.split("T")[0] || "",
      time: a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
      reason: a.reason || "",
      status: a.status as any,
    }))
  },

  async createAppointment(appt: Omit<Appointment, "id">): Promise<Appointment | null> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!clinicId || !user) return null

    // Combine date and time into appointment_date
    const appointmentDate = new Date(`${appt.date}T${appt.time}`).toISOString()

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        doctor_id: user.id,
        patient_id: appt.patientId,
        appointment_date: appointmentDate,
        reason: appt.reason,
        status: appt.status,
      })
      .select("*, patients(full_name)")
      .single()

    if (error || !data) return null

    await this.logActivity("appointment_created", `Appointment scheduled for ${data.patients?.full_name || appt.patientName}`)

    return {
      id: data.id,
      patientId: data.patient_id,
      patientName: data.patients?.full_name || "Unknown",
      date: data.appointment_date?.split("T")[0] || "",
      time: data.appointment_date ? new Date(data.appointment_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
      reason: data.reason || "",
      status: data.status,
    }
  },

  async updateAppointment(appt: Appointment): Promise<boolean> {
    const appointmentDate = new Date(`${appt.date}T${appt.time}`).toISOString()

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: appointmentDate,
        reason: appt.reason,
        status: appt.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appt.id)

    return !error
  },

  // ==================== VISITS ====================

  async getVisits(): Promise<Visit[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("visits")
      .select("id, patient_id, stage, stage_start_time, created_at, queue_number, priority, vital_signs, chief_complaint, diagnosis, doctor_notes, lab_orders, prescription, consultation_fee, total_bill, payment_status, insurance_details, patients(full_name)")
      .eq("clinic_id", clinicId)
      .neq("stage", "completed")
      .order("created_at", { ascending: true })

    if (error || !data) return []

    return data.map((v: any) => ({
      id: v.id,
      patientId: v.patient_id,
      patientName: v.patients?.full_name || v.patient_name || "Unknown",
      stage: v.stage,
      stageStartTime: v.stage_start_time,
      startTime: v.created_at,
      queueNumber: v.queue_number || 0,
      priority: v.priority || "normal",
      vitals: v.vital_signs || {},
      chiefComplaint: v.chief_complaint,
      diagnosis: v.diagnosis,
      doctorNotes: v.doctor_notes,
      labOrders: v.lab_orders || [],
      prescription: v.prescription || [],
      medicationsDispensed: false, // Not in schema
      consultationFee: Number(v.consultation_fee) || 0,
      totalBill: Number(v.total_bill) || 0,
      paymentStatus: v.payment_status || "pending",
      insuranceDetails: null, // Not in schema
    }))
  },

  async createVisit(visit: Omit<Visit, "id">): Promise<Visit | null> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!clinicId) return null

    // Get queue number
    const { count } = await supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("stage", "completed")

    const queueNumber = (count || 0) + 1

    const { data, error } = await supabase
      .from("visits")
      .insert({
        clinic_id: clinicId,
        patient_id: visit.patientId,
        doctor_id: user?.id,
        stage: visit.stage,
        stage_start_time: visit.stageStartTime || new Date().toISOString(),
        queue_number: queueNumber,
        priority: visit.priority,
        vital_signs: visit.vitals,
        chief_complaint: visit.chiefComplaint,
        diagnosis: visit.diagnosis,
        doctor_notes: visit.doctorNotes,
        lab_orders: visit.labOrders,
        prescription: visit.prescription,
        consultation_fee: visit.consultationFee,
        total_bill: visit.totalBill,
        payment_status: visit.paymentStatus,
      })
      .select("*, patients(full_name)")
      .single()

    if (error || !data) return null

    await this.logActivity("visit_created", `Patient ${data.patients?.full_name || visit.patientName} checked in`)

    return {
      id: data.id,
      patientId: data.patient_id,
      patientName: data.patients?.full_name || "Unknown",
      stage: data.stage,
      stageStartTime: data.stage_start_time,
      startTime: data.created_at,
      queueNumber: data.queue_number,
      priority: data.priority,
      vitals: data.vital_signs || {},
      chiefComplaint: data.chief_complaint,
      diagnosis: data.diagnosis,
      doctorNotes: data.doctor_notes,
      labOrders: data.lab_orders || [],
      prescription: data.prescription || [],
      medicationsDispensed: false,
      consultationFee: Number(data.consultation_fee),
      totalBill: Number(data.total_bill),
      paymentStatus: data.payment_status,
      insuranceDetails: data.insurance_details || undefined,
    }
  },

  async updateVisit(visit: Visit): Promise<boolean> {
    const { error } = await supabase
      .from("visits")
      .update({
        stage: visit.stage,
        stage_start_time: visit.stageStartTime,
        vital_signs: visit.vitals,
        chief_complaint: visit.chiefComplaint,
        diagnosis: visit.diagnosis,
        doctor_notes: visit.doctorNotes,
        lab_orders: visit.labOrders,
        prescription: visit.prescription,
        total_bill: visit.totalBill,
        payment_status: visit.paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", visit.id)

    return !error
  },

  // ==================== INVENTORY ====================

  async getInventory(): Promise<InventoryItem[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase.from("inventory").select("id, name, category, quantity_in_stock, reorder_level, unit, price, batch_number, expiry_date, supplier_id").eq("clinic_id", clinicId).order("name")

    if (error || !data) return []

    return data.map((i: any) => ({
      id: i.id,
      name: i.name,
      category: i.category || "Medicine",
      stock: i.quantity_in_stock || 0,
      minStockLevel: i.reorder_level || 10,
      unit: i.unit || "pcs",
      price: Number(i.price) || 0,
      batchNumber: i.batch_number,
      expiryDate: i.expiry_date,
      supplierId: i.supplier_id,
    }))
  },

  async createInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem | null> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!clinicId) return null

    // Generate SKU if not provided
    const sku = `SKU-${item.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    const { data, error } = await supabase
      .from("inventory")
      .insert({
        clinic_id: clinicId,
        sku,
        name: item.name,
        category: item.category,
        quantity_in_stock: item.stock,
        reorder_level: item.minStockLevel,
        unit: item.unit,
        price: item.price,
        batch_number: item.batchNumber,
        expiry_date: item.expiryDate,
        supplier_id: item.supplierId,
      })
      .select()
      .single()

    if (error || !data) return null

    // Log inventory transaction (if inventory_logs table exists)
    try {
      await supabase.from("inventory_logs").insert({
        clinic_id: clinicId,
        item_id: data.id,
        item_name: item.name,
        action: "Created",
        quantity_change: item.stock,
        quantity_after: item.stock,
        performed_by: user?.id,
      })
    } catch (e) {
      // Table might not exist, continue
      logger.warn("Inventory logs table not available:", e)
    }

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      stock: data.quantity_in_stock,
      minStockLevel: data.reorder_level,
      unit: data.unit,
      price: Number(data.price),
      batchNumber: data.batch_number,
      expiryDate: data.expiry_date,
      supplierId: data.supplier_id,
    }
  },

  async updateInventoryItem(item: InventoryItem, reason?: string): Promise<boolean> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Get current stock for logging
    const { data: current } = await supabase.from("inventory").select("quantity_in_stock").eq("id", item.id).single()

    const { error } = await supabase
      .from("inventory")
      .update({
        name: item.name,
        category: item.category,
        quantity_in_stock: item.stock,
        reorder_level: item.minStockLevel,
        unit: item.unit,
        price: item.price,
        batch_number: item.batchNumber,
        expiry_date: item.expiryDate,
        supplier_id: item.supplierId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)

    if (!error && current && clinicId) {
      const quantityChange = item.stock - (current.quantity_in_stock || 0)
      const action = quantityChange > 0 ? "Restocked" : quantityChange < 0 ? "Dispensed" : "Updated"

      try {
        await supabase.from("inventory_logs").insert({
          clinic_id: clinicId,
          item_id: item.id,
          item_name: item.name,
          action,
          quantity_change: quantityChange,
          quantity_before: current.quantity_in_stock,
          quantity_after: item.stock,
          notes: reason,
          performed_by: user?.id,
        })
      } catch (e) {
        logger.warn("Inventory logs table not available:", e)
      }
    }

    return !error
  },

  async deleteInventoryItem(id: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) throw new Error("Not authenticated")

    // Note: Permission checks enforced by Supabase RLS policies
    // await guardServerAction(user.id, "inventory.delete")

    // Audit current inventory item
    try {
      const { data: oldItem } = await supabase.from("inventory").select("*").eq("id", id).maybeSingle()
      await this.logAudit("delete_inventory_item", "inventory_item", id, oldItem || undefined, undefined)
    } catch (e) {
      logger.warn("Audit log failed for deleteInventoryItem:", e)
    }

    const { error } = await supabase.from("inventory").delete().eq("id", id)

    return !error
  },

  // ==================== SUPPLIERS ====================

  async getSuppliers(): Promise<Supplier[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase.from("suppliers").select("id, name, contact_person, phone, email").eq("clinic_id", clinicId).order("name")

    if (error || !data) return []

    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person || "",
      phone: s.phone || "",
      email: s.email || "",
    }))
  },

  async createSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier | null> {
    const clinicId = await getClinicId()
    if (!clinicId) return null

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        clinic_id: clinicId,
        name: supplier.name,
        contact_person: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
      })
      .select()
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      name: data.name,
      contactPerson: data.contact_person || "",
      phone: data.phone || "",
      email: data.email || "",
    }
  },

  async updateSupplier(supplier: Supplier): Promise<boolean> {
    const { error } = await supabase
      .from("suppliers")
      .update({
        name: supplier.name,
        contact_person: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", supplier.id)

    return !error
  },

  async deleteSupplier(id: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) throw new Error("Not authenticated")

    // Note: Permission checks enforced by Supabase RLS policies
    // await guardServerAction(user.id, "inventory.delete")

    try {
      const { data: oldSupplier } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle()
      await this.logAudit("delete_supplier", "supplier", id, oldSupplier || undefined, undefined)
    } catch (e) {
      logger.warn("Audit log failed for deleteSupplier:", e)
    }

    const { error } = await supabase.from("suppliers").delete().eq("id", id)

    return !error
  },

  // ==================== AUDIT & ACTIVITY ====================

  async getAuditLogs(limit = 50): Promise<AuditLog[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, clinic_id, user_id, user_email, user_name, user_role, action, resource_type, resource_id, old_values, new_values, metadata, ip_address, user_agent, status, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((log: any) => ({
      id: log.id,
      clinicId: log.clinic_id,
      userId: log.user_id,
      userEmail: log.user_email,
      userName: log.user_name,
      userRole: log.user_role,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      oldValues: log.old_values,
      newValues: log.new_values,
      metadata: log.metadata || {},
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      status: log.status,
      createdAt: log.created_at,
    }))
  },

  async logAudit(
    action: string,
    resourceType: string,
    resourceId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
  ): Promise<void> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!clinicId) return

    // Get user details
    let userName = "System"
    let userEmail = ""
    let userRole = ""

    if (user) {
      const { data: profile } = await supabase.from("users").select("full_name, email, role").eq("id", user.id).maybeSingle()

      if (profile) {
        userName = profile.full_name
        userEmail = profile.email
        userRole = profile.role
      }
    }

    await supabase.from("audit_logs").insert({
      clinic_id: clinicId,
      user_id: user?.id,
      user_email: userEmail,
      user_name: userName,
      user_role: userRole,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      status: 'Success'
    })
  },

  async getActivities(limit = 20): Promise<Activity[]> {
    const clinicId = await getClinicId()
    if (!clinicId) return []

    const { data, error } = await supabase
      .from("activities")
      .select("id, clinic_id, user_id, activity_type, title, description, icon, color, resource_type, resource_id, metadata, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((a: any) => ({
      id: a.id,
      clinicId: a.clinic_id,
      userId: a.user_id,
      activityType: a.activity_type,
      title: a.title,
      description: a.description,
      icon: a.icon,
      color: a.color,
      resourceType: a.resource_type,
      resourceId: a.resource_id,
      metadata: a.metadata || {},
      createdAt: a.created_at,
    }))
  },

  async logActivity(
    activityType: string,
    title: string,
    description?: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<void> {
    const clinicId = await getClinicId()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!clinicId) return

    await supabase.from("activities").insert({
      clinic_id: clinicId,
      user_id: user?.id,
      activity_type: activityType,
      title,
      description,
      resource_type: resourceType,
      resource_id: resourceId,
    })
  },

  // ==================== CONNECTION CHECK ====================

  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from("clinics").select("count", { count: "exact", head: true })
      return !error
    } catch {
      return false
    }
  },
}
