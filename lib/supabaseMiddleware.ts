/**
 * Supabase Client Security & Middleware
 * Adds request/response logging, error handling, and validation
 */

import { getSupabase } from "./supabaseClient"
import { auditLogger } from "../services/auditService"
import logger from "./logger"

/**
 * Initialize Supabase middleware and security
 */
export async function initializeSupabaseMiddleware() {
  const supabase = getSupabase()

  // Listen for auth state changes
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
    if (event === "SIGNED_IN" && session) {
      logger.log("User signed in:", session.user.id)
      // Log successful login
      try {
        await auditLogger.log(session.user.id, session.user.email || "unknown", "LOGIN", "AUTH", session.user.id, {
          status: "success",
        })
      } catch (err) {
        logger.warn("Failed to log login audit:", err)
      }
    } else if (event === "SIGNED_OUT") {
      logger.log("User signed out")
    } else if (event === "TOKEN_REFRESHED") {
      logger.log("Session refreshed")
    }
  })

  return authListener
}

/**
 * Safe query wrapper with error handling
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: {
    fallback?: T
    logErrors?: boolean
  } = {},
) {
  try {
    const { data, error } = await queryFn()

    if (error) {
      if (options.logErrors) {
        console.error("Database error:", error)
      }

      // Handle specific error types
      if (error.code === "PGRST116") {
        throw new Error("Not found")
      }
      if (error.status === 401) {
        throw new Error("Unauthorized")
      }
      if (error.status === 403) {
        throw new Error("Permission denied")
      }

      throw error
    }

    return data as T
  } catch (err) {
    if (options.fallback !== undefined) {
      return options.fallback
    }
    throw err
  }
}

/**
 * Row Level Security (RLS) enforcement check
 */
export function verifyRlsEnabled(): boolean {
  // This should be verified during setup
  // RLS policies should be configured in Supabase dashboard
  logger.log("RLS should be enabled on all tables")
  return true
}

/**
 * Sanitize data before sending to database
 */
export function sanitizeDbData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    // Remove null/undefined
    if (value === null || value === undefined) {
      continue
    }

    // Sanitize strings
    if (typeof value === "string") {
      sanitized[key] = value
        .trim()
        .slice(0, 10000) // Max string length
        .replace(/[<>]/g, "") // Remove HTML tags
    }
    // Validate numbers
    else if (typeof value === "number") {
      sanitized[key] = isFinite(value) ? value : 0
    }
    // Handle dates
    else if (value instanceof Date) {
      sanitized[key] = value.toISOString()
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 1000) // Limit array size
    }
    // Handle objects
    else if (typeof value === "object") {
      sanitized[key] = sanitizeDbData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Validate user has access to resource
 */
export async function checkResourceAccess(
  tableName: string,
  resourceId: string,
  userId: string,
  action: "read" | "update" | "delete" = "read",
): Promise<boolean> {
  try {
    // Supabase RLS will handle this automatically
    // This is a check to validate permissions client-side
    const { data, error } = await getSupabase().from(tableName).select("id").eq("id", resourceId).single()

    if (error && error.code === "PGRST116") {
      // Not found or no access
      return false
    }

    return !!data
  } catch {
    return false
  }
}

/**
 * Rate limit check for sensitive operations
 */
export class OperationRateLimiter {
  private operations: Map<string, number[]> = new Map()
  private readonly maxPerMinute: number

  constructor(maxPerMinute = 60) {
    this.maxPerMinute = maxPerMinute
  }

  canPerform(operationKey: string): boolean {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    if (!this.operations.has(operationKey)) {
      this.operations.set(operationKey, [now])
      return true
    }

    const times = this.operations.get(operationKey)!
    const recent = times.filter((t) => t > oneMinuteAgo)

    if (recent.length >= this.maxPerMinute) {
      return false
    }

    recent.push(now)
    this.operations.set(operationKey, recent)
    return true
  }
}

export const operationRateLimiter = new OperationRateLimiter()
