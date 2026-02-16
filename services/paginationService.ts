/**
 * Server-Side Pagination Service
 * Handles paginated queries for large datasets
 */

import { supabase } from "../lib/supabaseClient"

export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  filters?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}

export const paginationService = {
  /**
   * Get paginated patients
   */
  async getPaginatedPatients(params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page, pageSize, sortBy = "created_at", sortOrder = "desc", filters = {} } = params
    const offset = (page - 1) * pageSize

    // Get current user's clinic_id
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const { data: userData } = await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    if (!userData?.clinic_id) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    // Build query
    let query = supabase.from("patients").select("*", { count: "exact" }).eq("clinic_id", userData.clinic_id)

    // Apply filters
    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,mrn.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`)
    }
    if (filters.gender) {
      query = query.eq("gender", filters.gender)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" })

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching paginated patients:", error)
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    }
  },

  /**
   * Get paginated appointments
   */
  async getPaginatedAppointments(params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page, pageSize, sortBy = "appointment_date", sortOrder = "desc", filters = {} } = params
    const offset = (page - 1) * pageSize

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const { data: userData } = await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    if (!userData?.clinic_id) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    let query = supabase
      .from("appointments")
      .select("*, patients(full_name)", { count: "exact" })
      .eq("clinic_id", userData.clinic_id)

    if (filters.status) {
      query = query.eq("status", filters.status)
    }
    if (filters.dateFrom) {
      query = query.gte("appointment_date", filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte("appointment_date", filters.dateTo)
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching paginated appointments:", error)
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    }
  },

  /**
   * Get paginated visits
   */
  async getPaginatedVisits(params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page, pageSize, sortBy = "created_at", sortOrder = "desc", filters = {} } = params
    const offset = (page - 1) * pageSize

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const { data: userData } = await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    if (!userData?.clinic_id) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    let query = supabase
      .from("visits")
      .select("*, patients(full_name)", { count: "exact" })
      .eq("clinic_id", userData.clinic_id)

    if (filters.stage) {
      query = query.eq("stage", filters.stage)
    }
    if (filters.status) {
      query = query.eq("payment_status", filters.status)
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching paginated visits:", error)
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    }
  },

  /**
   * Get paginated inventory
   */
  async getPaginatedInventory(params: PaginationParams): Promise<PaginatedResponse<any>> {
    const { page, pageSize, sortBy = "name", sortOrder = "asc", filters = {} } = params
    const offset = (page - 1) * pageSize

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const { data: userData } = await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    if (!userData?.clinic_id) {
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    let query = supabase.from("inventory").select("*", { count: "exact" }).eq("clinic_id", userData.clinic_id)

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
    }
    if (filters.category) {
      query = query.eq("category", filters.category)
    }
    if (filters.lowStock) {
      query = query.lte("quantity_in_stock", supabase.raw("reorder_level"))
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching paginated inventory:", error)
      return { data: [], total: 0, page, pageSize, totalPages: 0, hasMore: false }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      data: data || [],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    }
  },
}
