/**
 * Gemini Configuration Status Check
 * Use this to verify that Gemini API credentials are properly configured
 */

import { supabase } from "../supabaseClient"
import logger from "../logger"

// Cache the availability check for 5 minutes to avoid repeated test calls
let cachedStatus: {
  available: boolean
  error?: string
  reason?: string
  timestamp: number
} | null = null

const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if Gemini is available by testing the edge function
 * Returns a boolean - use this for simple feature flags
 */
export async function isGeminiAvailable(): Promise<boolean> {
  try {
    const status = await getGeminiStatus()
    return status.available
  } catch (error) {
    logger.error("[Gemini] Error checking availability:", error)
    return false
  }
}

/**
 * Get detailed Gemini configuration status
 * Returns status object with available flag, error code, and reason
 */
export async function getGeminiStatus(): Promise<{
  available: boolean
  error?: string
  reason?: string
}> {
  // Return cached status if still valid
  if (cachedStatus && Date.now() - cachedStatus.timestamp < CACHE_DURATION_MS) {
    logger.log("[Gemini] Returning cached status")
    return {
      available: cachedStatus.available,
      error: cachedStatus.error,
      reason: cachedStatus.reason,
    }
  }

  logger.log("[Gemini] Checking configuration status...")

  try {
    // Test the edge function with a minimal request
    const { data, error } = await supabase.functions.invoke("gemini-chat", {
      body: {
        prompt: "test",
        model: "gemini-1.5-flash",
      },
    })

    // Check for errors
    if (error) {
      logger.warn("[Gemini] Edge function error object:", error)
      if (error instanceof Error) {
        logger.warn("[Gemini] Error details:", {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name
        })
      }

      // Cache the failed status
      cachedStatus = {
        available: false,
        error: "EDGE_FUNCTION_ERROR",
        reason: error.message || "Edge function invocation failed",
        timestamp: Date.now(),
      }

      return {
        available: false,
        error: "EDGE_FUNCTION_ERROR",
        reason: error.message || "Edge function invocation failed",
      }
    }

    // Check response for API key configuration error
    if (data?.error?.includes("GEMINI_API_KEY") || data?.error?.includes("not configured")) {
      logger.warn("[Gemini] API key not configured:", data.error)

      // Cache the failed status
      cachedStatus = {
        available: false,
        error: "API_KEY_NOT_CONFIGURED",
        reason: "GEMINI_API_KEY environment variable is not set in Supabase",
        timestamp: Date.now(),
      }

      return {
        available: false,
        error: "API_KEY_NOT_CONFIGURED",
        reason: "GEMINI_API_KEY environment variable is not set in Supabase",
      }
    }

    // Check for other errors in response
    if (data?.error) {
      logger.warn("[Gemini] API error:", data.error)

      // Determine error type
      let errorType = "UNKNOWN_ERROR"
      if (data.error.includes("401") || data.error.includes("Unauthenticated")) {
        errorType = "INVALID_API_KEY"
      } else if (data.error.includes("429")) {
        errorType = "RATE_LIMITED"
      } else if (data.error.includes("timeout") || data.error.includes("timed out")) {
        errorType = "TIMEOUT"
      }

      // Cache the failed status
      cachedStatus = {
        available: false,
        error: errorType,
        reason: data.error,
        timestamp: Date.now(),
      }

      return {
        available: false,
        error: errorType,
        reason: data.error,
      }
    }

    // Success!
    logger.log("[Gemini] Configuration check passed - Gemini is available")

    // Cache the successful status
    cachedStatus = {
      available: true,
      timestamp: Date.now(),
    }

    return {
      available: true,
    }
  } catch (err: any) {
    logger.error("[Gemini] Unexpected error during config check:", err)

    // Cache the failed status
    cachedStatus = {
      available: false,
      error: "UNEXPECTED_ERROR",
      reason: err?.message || "Unexpected error checking Gemini availability",
      timestamp: Date.now(),
    }

    return {
      available: false,
      error: "UNEXPECTED_ERROR",
      reason: err?.message || "Unexpected error checking Gemini availability",
    }
  }
}

/**
 * Clear the cached status (useful for testing or manual refresh)
 */
export function clearGeminiStatusCache() {
  cachedStatus = null
  logger.log("[Gemini] Cache cleared")
}

/**
 * Log Gemini configuration status with helpful setup instructions
 */
export function logGeminiStatus() {
  getGeminiStatus().then((status) => {
    if (status.available) {
      logger.log(
        "%c✅ Gemini Configuration Status: READY",
        "color: green; font-weight: bold; font-size: 14px"
      )
      logger.log("   AI features are enabled and ready to use")
    } else {
      logger.warn(
        "%c⚠️ Gemini Configuration Status: NOT AVAILABLE",
        "color: orange; font-weight: bold; font-size: 14px"
      )
      logger.warn(`   Error: ${status.error}`)
      logger.warn(`   Reason: ${status.reason}`)

      if (status.error === "API_KEY_NOT_CONFIGURED") {
        logger.warn("\n   To enable AI features, follow these steps:")
        logger.warn("   1. Get a Gemini API key from https://aistudio.google.com/")
        logger.warn("   2. Go to Supabase Dashboard → Settings → Edge Function Secrets")
        logger.warn("   3. Add new secret:")
        logger.warn("      Name: GEMINI_API_KEY")
        logger.warn("      Value: <your-api-key>")
        logger.warn("   4. Deploy the edge function:")
        logger.warn("      supabase functions deploy gemini-chat")
        logger.warn("   5. Restart the dev server")
      } else if (status.error === "INVALID_API_KEY") {
        logger.warn("\n   The GEMINI_API_KEY appears to be invalid or expired.")
        logger.warn("   Please verify the API key at https://aistudio.google.com/")
        logger.warn("   and update it in Supabase settings.")
      } else if (status.error === "RATE_LIMITED") {
        logger.warn("\n   Gemini API rate limit exceeded.")
        logger.warn("   Please wait a moment and try again, or upgrade your API plan.")
      }
    }
  })
}
